<?php
// Installazione: crea le tabelle e imposta le password. Funziona una sola volta.
// Dopo l'installazione puoi cancellare questo file dal server.

require __DIR__ . '/db.php';

$messaggio = '';
$completato = false;

try {
    crea_tabelle();
    if (installato()) {
        $completato = true;
        $messaggio = "L'app è già installata. Per sicurezza puoi eliminare il file install.php dal server.";
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $admin = (string) ($_POST['admin'] ?? '');
        $genitori = (string) ($_POST['genitori'] ?? '');
        if (mb_strlen($admin) < 8) {
            $messaggio = 'La password del rappresentante deve avere almeno 8 caratteri.';
        } elseif (mb_strlen($genitori) < 6) {
            $messaggio = 'Il codice per i genitori deve avere almeno 6 caratteri.';
        } elseif ($admin === $genitori) {
            $messaggio = 'La password del rappresentante e il codice genitori devono essere diversi.';
        } else {
            $pdo = db();
            $pdo->beginTransaction();
            $st = $pdo->prepare('INSERT INTO classe_accessi (ruolo, hash) VALUES (?, ?)');
            $st->execute(['admin', password_hash($admin, PASSWORD_DEFAULT)]);
            $st->execute(['genitore', password_hash($genitori, PASSWORD_DEFAULT)]);
            $vuoto = json_encode([
                'classe' => ['nome' => '', 'scuola' => '', 'anno' => ''],
                'alunni' => [], 'movimenti' => [], 'raccolte' => [], 'eventi' => [], 'annunci' => [],
            ]);
            $pdo->prepare('INSERT IGNORE INTO classe_dati (id, dati, versione, aggiornato) VALUES (1, ?, 0, NOW())')
                ->execute([$vuoto]);
            $pdo->commit();
            $completato = true;
            $messaggio = 'Installazione completata! Ora elimina il file install.php dal server e apri l\'app.';
        }
    }
} catch (PDOException $e) {
    $messaggio = 'Impossibile collegarsi al database: controlla i dati in config.php. (' . $e->getMessage() . ')';
}
?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Installazione</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body style="padding-bottom:0">
  <header class="topbar"><h1>Installazione app classe</h1></header>
  <main>
    <?php if ($messaggio): ?>
      <div class="card"><p style="margin:0"><?= htmlspecialchars($messaggio) ?></p></div>
    <?php endif; ?>
    <?php if ($completato): ?>
      <a class="btn primary" href="./" style="display:inline-block;text-decoration:none">Apri l'app</a>
    <?php else: ?>
      <form method="post" class="card">
        <p class="muted" style="margin-bottom:14px">Scegli le credenziali di accesso. Potrai cambiarle in seguito dalla sezione Classe.</p>
        <div class="field">
          <label for="admin">Password del rappresentante (almeno 8 caratteri)</label>
          <input id="admin" name="admin" type="password" required minlength="8" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="genitori">Codice di accesso per i genitori (almeno 6 caratteri)</label>
          <input id="genitori" name="genitori" type="text" required minlength="6">
        </div>
        <button class="btn primary" type="submit">Installa</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
