import { env } from "./config/env";
import { mailHint, sendTestEmail } from "./services/mailer";

// Usage: npm run mail:test -- you@example.com
const to = process.argv[2] ?? env.SMTP_USER;
if (!to) { console.error("Give an address: npm run mail:test -- you@example.com"); process.exit(1); }

sendTestEmail(to)
  .then(() => console.log(`Sent. Check the inbox (and spam) of ${to}.`))
  .catch((e) => { console.error(`\nFAILED: ${mailHint(e)}\n`); process.exit(1); });
