# Rappresentante di Classe

Web app (PWA) per il rappresentante di classe: **cassa**, **raccolte fondi**, **calendario** e **annunci**.
Funziona su telefono e computer, si può installare sulla schermata Home e funziona anche offline.

## Funzionalità

- **Cassa**: entrate e uscite con categorie, saldo, filtri, esportazione CSV (apribile con Excel), rendiconto da condividere su WhatsApp.
- **Raccolte fondi**: quota a testa e scadenza, stato del pagamento di ogni alunno. I pagamenti finiscono automaticamente in cassa. Il promemoria per WhatsApp elenca chi deve ancora pagare.
- **Calendario**: vista mensile, eventi con ora, luogo e note, condivisione, esportazione `.ics` verso Google Calendar o il calendario del telefono.
- **Annunci**: bacheca con annunci fissati in alto e condivisione con un tocco.
- **Classe**: dati della classe, elenco alunni con contatti dei genitori (si può incollare un elenco intero), backup e ripristino dei dati.

## Pubblicazione online su TopHost (PHP + MySQL)

Con PHP e MySQL i dati stanno nel database: il rappresentante li gestisce da qualsiasi dispositivo
e i genitori li consultano online.

1. **Crea il database**: nel pannello di controllo TopHost apri la sezione *Database MySQL* e crea un database.
   Annota host, nome del database, utente e password.
2. **Prepara la configurazione**: copia `config.example.php` come `config.php` e inserisci quei quattro dati.
3. **Carica i file** via FTP (ad esempio con FileZilla, usando le credenziali FTP del pannello) nella cartella
   principale del sito: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icon.svg`,
   `api.php`, `db.php`, `install.php`, `config.php`, `.htaccess`.
   Il file `.htaccess` inizia con un punto: se non lo vedi, attiva in FileZilla la visualizzazione dei file nascosti.
4. **Installa**: apri `https://tuodominio.it/install.php` e scegli la password del rappresentante
   e il codice di accesso per i genitori.
5. **Elimina `install.php`** dal server.
6. **HTTPS**: attiva il certificato SSL dal pannello TopHost, poi togli i `#` dalle righe indicate
   in `.htaccess` per forzare la connessione sicura.

Se avevi già usato l'app sul telefono senza server, al primo accesso come rappresentante ti verrà proposto
di caricare online quei dati.

### Accessi

| Chi | Come entra | Cosa vede |
| --- | --- | --- |
| Rappresentante | password | tutto, e può modificare |
| Genitori | codice di accesso condiviso | annunci, calendario, saldo e spese, avanzamento delle raccolte (senza nomi né contatti degli alunni) |

Password e codice si cambiano da *Classe → Accesso online*.

## Uso senza server

Senza PHP l'app funziona lo stesso, con i dati salvati **solo nel browser del dispositivo** (localStorage):

- **In locale**: `python3 -m http.server` nella cartella del progetto, poi apri http://localhost:8000
- **GitHub Pages**: Settings → Pages → branch `master`, cartella `/`.

In questo caso usa *Classe → Esporta backup* con regolarità e per spostare i dati su un altro dispositivo.

Dal telefono apri l'indirizzo e scegli "Aggiungi a schermata Home".
