#!/usr/bin/env node
/* eslint-disable no-console */

import Enquirer from 'enquirer';
import Verisure from 'verisure';

// enquirer's bundled types only declare `prompt`/`Prompt`, not the individual
// prompt classes (like `Password`) it also exports at runtime.
const { prompt } = Enquirer;
const Password = (Enquirer as unknown as {
  Password: new (options: Record<string, unknown>) => { run(): Promise<string> };
}).Password;

const validate = (value: string) => !!value.length;

const run = async (): Promise<void> => {
  const { email } = await prompt<{ email: string }>({
    type: 'input',
    name: 'email',
    message: 'What is your login email?',
    validate,
  });

  const password = await new Password({
    name: 'password',
    message: 'What is your password?',
    validate,
  }).run();

  const verisure = new Verisure(email.trim(), password);

  await verisure.getToken();

  if (!verisure.getCookie('vid')) {
    console.log('\n', 'One-time code sent.', '\n');

    const { code } = await prompt<{ code: string }>({
      type: 'input',
      name: 'code',
      message: 'What is your one-time code?',
      validate,
    });

    await verisure.getToken(code.trim());
  }

  const missingCookies = ['vid', 'vs-access', 'vs-refresh']
    .filter((prefix) => !verisure.getCookie(prefix));
  if (missingCookies.length > 0) {
    console.log('\n', `Warning: didn't receive a ${missingCookies.join(', ')} cookie. Your config below may not work - try running this again.`, '\n');
  }

  console.log('\n', 'Your config is ready.', '\n');

  console.log(JSON.stringify({
    platform: 'verisure',
    name: 'Verisure',
    email,
    cookies: verisure.cookies,
  }, null, 2));
};

run().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
