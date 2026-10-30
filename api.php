<?php
// API dell'app: login, lettura e salvataggio dei dati della classe.

require __DIR__ . '/db.php';

session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
session_start();

const MAX_TENTATIVI = 10;      // tentativi di login falliti...
const FINESTRA_MINUTI = 15;    // ...in questo intervallo, per indirizzo IP

$azione = $_GET['azione'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

try {
    if (!installato()) {
        rispondi(['errore' => 'non_installato'], 503);
    }

    if ($metodo === 'POST') {
        // Le richieste di modifica devono arrivare dall'app stessa (protezione CSRF).
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'classe-app') {
            rispondi(['errore' => 'richiesta_non_valida'], 400);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            $input = [];
        }
    }

    switch ("$metodo $azione") {
        case 'GET stato':
            richiedi_ruolo(['admin', 'genitore']);
            $riga = db()->query('SELECT dati, versione FROM classe_dati WHERE id = 1')->fetch();
            $dati = json_decode($riga['dati'], true);
            if ($_SESSION['ruolo'] === 'genitore') {
                $dati = vista_genitori($dati);
            }
            rispondi(['ruolo' => $_SESSION['ruolo'], 'versione' => (int) $riga['versione'], 'dati' => $dati]);

        case 'POST login':
            login((string) ($input['password'] ?? ''));

        case 'POST logout':
            $_SESSION = [];
            session_destroy();
            rispondi(['ok' => true]);

        case 'POST salva':
            richiedi_ruolo(['admin']);
            salva($input);

        case 'POST password':
            richiedi_ruolo(['admin']);
            $ruolo = $input['ruolo'] ?? '';
            $nuova = (string) ($input['nuova'] ?? '');
            if (!in_array($ruolo, ['admin', 'genitore'], true)) {
                rispondi(['errore' => 'ruolo_non_valido'], 400);
            }
            if (mb_strlen($nuova) < ($ruolo === 'admin' ? 8 : 6)) {
                rispondi(['errore' => 'password_corta'], 400);
            }
            if (password_verify($nuova, hash_ruolo($ruolo === 'admin' ? 'genitore' : 'admin'))) {
                rispondi(['errore' => 'password_uguale'], 400);
            }
            $st = db()->prepare('UPDATE classe_accessi SET hash = ? WHERE ruolo = ?');
            $st->execute([password_hash($nuova, PASSWORD_DEFAULT), $ruolo]);
            rispondi(['ok' => true]);

        default:
            rispondi(['errore' => 'azione_sconosciuta'], 404);
    }
} catch (PDOException $e) {
    error_log('Errore database: ' . $e->getMessage());
    rispondi(['errore' => 'database'], 500);
}

function richiedi_ruolo(array $ruoli)
{
    if (!in_array($_SESSION['ruolo'] ?? '', $ruoli, true)) {
        rispondi(['errore' => 'login'], 401);
    }
}

function hash_ruolo($ruolo)
{
    $st = db()->prepare('SELECT hash FROM classe_accessi WHERE ruolo = ?');
    $st->execute([$ruolo]);
    return (string) $st->fetchColumn();
}

function login($password)
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    db()->exec('DELETE FROM classe_tentativi WHERE quando < NOW() - INTERVAL 1 DAY');
    $st = db()->prepare('SELECT COUNT(*) FROM classe_tentativi WHERE ip = ? AND quando > NOW() - INTERVAL ' . FINESTRA_MINUTI . ' MINUTE');
    $st->execute([$ip]);
    if ((int) $st->fetchColumn() >= MAX_TENTATIVI) {
        rispondi(['errore' => 'troppi_tentativi'], 429);
    }

    foreach (['admin', 'genitore'] as $ruolo) {
        if ($password !== '' && password_verify($password, hash_ruolo($ruolo))) {
            session_regenerate_id(true);
            $_SESSION['ruolo'] = $ruolo;
            rispondi(['ruolo' => $ruolo]);
        }
    }

    db()->prepare('INSERT INTO classe_tentativi (ip, quando) VALUES (?, NOW())')->execute([$ip]);
    usleep(500000);
    rispondi(['errore' => 'password_errata'], 401);
}

function salva(array $input)
{
    $dati = $input['dati'] ?? null;
    $versione = $input['versione'] ?? null;
    if (!is_array($dati) || !is_int($versione)) {
        rispondi(['errore' => 'dati_non_validi'], 400);
    }
    foreach (['alunni', 'movimenti', 'raccolte', 'eventi', 'annunci'] as $chiave) {
        if (!isset($dati[$chiave]) || !is_array($dati[$chiave])) {
            rispondi(['errore' => 'dati_non_validi'], 400);
        }
    }
    $json = json_encode($dati, JSON_UNESCAPED_UNICODE);
    if (strlen($json) > 5 * 1024 * 1024) {
        rispondi(['errore' => 'dati_troppo_grandi'], 413);
    }

    // Blocco ottimistico: se un altro dispositivo ha salvato nel frattempo, il salvataggio viene rifiutato.
    $st = db()->prepare('UPDATE classe_dati SET dati = ?, versione = versione + 1, aggiornato = NOW() WHERE id = 1 AND versione = ?');
    $st->execute([$json, $versione]);
    if ($st->rowCount() === 0) {
        rispondi(['errore' => 'conflitto'], 409);
    }
    rispondi(['versione' => $versione + 1]);
}

// I genitori vedono annunci, calendario, il rendiconto delle spese e
// l'avanzamento delle raccolte, ma non i nomi né i contatti degli alunni.
function vista_genitori(array $d)
{
    $idAlunni = array_column($d['alunni'] ?? [], 'id');
    $entrate = 0;
    $uscite = [];
    $totUscite = 0;
    foreach ($d['movimenti'] ?? [] as $m) {
        if ($m['tipo'] === 'entrata') {
            $entrate += $m['importo'];
        } else {
            $totUscite += $m['importo'];
            $uscite[] = [
                'data' => $m['data'], 'descrizione' => $m['descrizione'],
                'categoria' => $m['categoria'], 'importo' => $m['importo'],
            ];
        }
    }

    $raccolte = [];
    foreach ($d['raccolte'] ?? [] as $r) {
        $partecipanti = array_values(array_intersect($r['partecipanti'] ?? [], $idAlunni));
        $pagamenti = $r['pagamenti'] ?? [];
        $pagati = 0;
        foreach ($partecipanti as $id) {
            if (isset($pagamenti[$id])) {
                $pagati++;
            }
        }
        $raccolto = 0;
        foreach ($pagamenti as $p) {
            $raccolto += $p['importo'];
        }
        $raccolte[] = [
            'id' => $r['id'], 'titolo' => $r['titolo'], 'descrizione' => $r['descrizione'],
            'quota' => $r['quota'], 'scadenza' => $r['scadenza'], 'chiusa' => $r['chiusa'],
            'creato' => $r['creato'], 'pagati' => $pagati, 'totale' => count($partecipanti),
            'raccolto' => $raccolto,
        ];
    }

    return [
        'classe' => $d['classe'] ?? [],
        'eventi' => $d['eventi'] ?? [],
        'annunci' => $d['annunci'] ?? [],
        'raccolte' => $raccolte,
        'cassa' => ['entrate' => $entrate, 'uscite' => $totUscite, 'dettaglioUscite' => $uscite],
    ];
}
