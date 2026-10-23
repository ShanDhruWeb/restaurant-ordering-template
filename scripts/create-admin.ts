// npm run create-admin
// Creates a staff login, or resets the password of an existing one (which also
// logs that account out everywhere). There are NO default accounts.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Output that can be muted so passwords are not echoed to the terminal.
let muted = false;
const output = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    muted = hidden;
    rl.question("", (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("Create or reset a staff (admin) login.\n");
  const email = z.email().parse((await ask("Email: ")).toLowerCase());
  const password = await ask("Password (10 to 72 characters, hidden): ", true);
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  if (password.length > 72) throw new Error("Password must be at most 72 characters.");
  const again = await ask("Repeat password: ", true);
  if (again !== password) throw new Error("Passwords do not match.");

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.adminUser.update({
      where: { email },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    console.log(`\nPassword reset for ${email}. Old sessions are logged out.`);
  } else {
    await prisma.adminUser.create({ data: { email, passwordHash } });
    console.log(`\nCreated admin ${email}. Log in at /admin/login.`);
  }
}

main()
  .catch((err) => {
    console.error("\nFailed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
