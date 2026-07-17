export type SlashDocUser = {
  id: string;
  fullName: string;
  email: string;
  photo: string;
  link: string;
};

const MOCK_USERS: SlashDocUser[] = [
  createMockUser('anna-smirnova', 'Анна Смирнова', 'anna.smirnova@example.com', '#2563eb'),
  createMockUser('mikhail-volkov', 'Михаил Волков', 'mikhail.volkov@example.com', '#7c3aed'),
  createMockUser('elena-orlova', 'Елена Орлова', 'elena.orlova@example.com', '#db2777'),
  createMockUser('alexey-morozov', 'Алексей Морозов', 'alexey.morozov@example.com', '#0891b2'),
  createMockUser('olga-petrova', 'Ольга Петрова', 'olga.petrova@example.com', '#16a34a'),
  createMockUser('dmitry-sokolov', 'Дмитрий Соколов', 'dmitry.sokolov@example.com', '#ea580c'),
];

export function searchMockUsers(query: string, limit = 20): SlashDocUser[] {
  const normalized = query.trim().toLocaleLowerCase('ru');
  return MOCK_USERS.filter(
    (user) =>
      !normalized ||
      user.fullName.toLocaleLowerCase('ru').includes(normalized) ||
      user.email.toLocaleLowerCase('ru').includes(normalized),
  ).slice(0, Math.max(1, Math.min(limit, 50)));
}

function createMockUser(id: string, fullName: string, email: string, color: string): SlashDocUser {
  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${color}"/><text x="32" y="39" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="22" font-weight="700">${initials}</text></svg>`;
  return {
    id,
    fullName,
    email,
    photo: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
    link: `https://example.com/users/${id}`,
  };
}
