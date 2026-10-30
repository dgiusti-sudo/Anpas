# Rappresentante di Classe

Web app (PWA) per il rappresentante di classe: **cassa**, **raccolte fondi**, **calendario** e **annunci**.
Funziona su telefono e computer, si può installare sulla schermata Home e funziona anche offline.

## Funzionalità

- **Cassa**: entrate e uscite con categorie, saldo, filtri, esportazione CSV (apribile con Excel), rendiconto da condividere su WhatsApp.
- **Raccolte fondi**: quota a testa e scadenza, stato del pagamento di ogni alunno. I pagamenti finiscono automaticamente in cassa. Il promemoria per WhatsApp elenca chi deve ancora pagare.
- **Calendario**: vista mensile, eventi con ora, luogo e note, condivisione, esportazione `.ics` verso Google Calendar o il calendario del telefono.
- **Annunci**: bacheca con annunci fissati in alto e condivisione con un tocco.
- **Classe**: dati della classe, elenco alunni con contatti dei genitori (si può incollare un elenco intero), backup e ripristino dei dati.

## Come usarla

Non serve installare né compilare niente: sono file statici.

- **In locale**: `python3 -m http.server` nella cartella del progetto, poi apri http://localhost:8000
- **Online gratis**: pubblica il repository con GitHub Pages (Settings → Pages → branch `master`, cartella `/`).

Dal telefono apri l'indirizzo e scegli "Aggiungi a schermata Home".

## Dati e privacy

I dati sono salvati **solo nel browser del dispositivo** (localStorage) e non vengono mai inviati a un server.
Usa *Classe → Esporta backup* con regolarità e per spostare i dati su un altro dispositivo.
