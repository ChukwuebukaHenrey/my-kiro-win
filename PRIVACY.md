# Privacy

DREAME has two apps, Shop Challenge and Practice Path. Neither app collects personal data. Neither has accounts, sign-up or analytics.

- The apps ask for no name, email address or phone number.
- The apps send nothing about you to any server.
- The demo activities are bundled into each app. The apps make no network request for them.
- The apps are static files hosted on Vercel. Vercel, as the host, receives the standard request data that any website receives, such as your IP address.

**Shop Challenge**

- Shop Challenge stores nothing on your device.
- When you open a seller's link, you leave the app. The seller's site has its own privacy terms.

**Practice Path**

- Practice Path saves your practice progress in this browser on this device only, under the storage key `dreame.practice-path.progress`. It never sends your progress to a server.
- For each question it keeps four values: how many times you answered it (`seen`), how many times your first answer was wrong (`firstTryMisses`), your latest result (`last`) and the time of that attempt (`lastSeenAt`). It does not keep which options you picked, and it keeps nothing else about you.
- To remove your progress, use "Clear progress" on the Practice Path home page, or clear this site's data in your browser settings.
- "Export progress" saves the file `practice-path-progress.json` on your device. The file stays with you; the app does not upload it. "Import progress" reads a file you pick on this device.
- "Send result to tutor" opens WhatsApp only when you choose it. The message holds the lesson title, your two scores and the topics to review, and WhatsApp shows it to you before you send it. WhatsApp has its own privacy terms.
- The answers are part of the app's page, so Practice Path is for practice, not for graded tests.
