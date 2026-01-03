import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemFile = path.resolve(__dirname, '../data/system.json');
const usersDir = path.resolve(__dirname, '../data/users');

if (!fs.existsSync(systemFile)) {
  console.error('System file not found');
  process.exit(1);
}

const systemData = JSON.parse(fs.readFileSync(systemFile, 'utf-8'));
const users = systemData.users || [];

const testers = [
  { username: 'tester01', password: 'password123' },
  { username: 'tester02', password: 'password123' }
];

let changed = false;

testers.forEach(tester => {
  if (!users.find(u => u.username === tester.username)) {
    const newUser = {
      id: crypto.randomUUID(),
      username: tester.username,
      password: tester.password,
      role: 'user',
      createdAt: Date.now(),
      collectionVisibility: 'public'
    };
    users.push(newUser);

    // Create user directory
    const userDir = path.resolve(usersDir, newUser.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    console.log(`Created user: ${tester.username}`);
    changed = true;
  } else {
    console.log(`User already exists: ${tester.username}`);
  }
});

if (changed) {
  systemData.users = users;
  fs.writeFileSync(systemFile, JSON.stringify(systemData, null, 2));
  console.log('System data updated.');
}
