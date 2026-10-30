<?php
// Funzioni comuni: connessione al database e risposte JSON.

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['errore' => 'config_mancante']);
    exit;
}
require __DIR__ . '/config.php';

function db()
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }
    return $pdo;
}

function crea_tabelle()
{
    db()->exec('CREATE TABLE IF NOT EXISTS classe_dati (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        dati LONGTEXT NOT NULL,
        versione INT UNSIGNED NOT NULL DEFAULT 0,
        aggiornato DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    db()->exec('CREATE TABLE IF NOT EXISTS classe_accessi (
        ruolo VARCHAR(20) NOT NULL PRIMARY KEY,
        hash VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    db()->exec('CREATE TABLE IF NOT EXISTS classe_tentativi (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        quando DATETIME NOT NULL,
        INDEX (ip, quando)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function installato()
{
    try {
        return (int) db()->query('SELECT COUNT(*) FROM classe_accessi')->fetchColumn() >= 2;
    } catch (PDOException $e) {
        return false;
    }
}

function rispondi($dati, $codice = 200)
{
    http_response_code($codice);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dati, JSON_UNESCAPED_UNICODE);
    exit;
}
