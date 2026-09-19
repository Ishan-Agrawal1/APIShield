export const SEED_PASSWORD = 'password123';

export const SEED_USERS = [
  { id: 1, email: 'user1@test.com', password: SEED_PASSWORD, role: 'user' as const },
  { id: 2, email: 'user2@test.com', password: SEED_PASSWORD, role: 'user' as const },
  { id: 3, email: 'admin@test.com', password: SEED_PASSWORD, role: 'admin' as const },
] as const;

export const SEED_NOTES = [
  {
    id: 1,
    userId: 1,
    title: 'User 1 Note',
    content: 'Private note belonging to User 1.',
    visibility: 'private' as const,
  },
  {
    id: 2,
    userId: 2,
    title: 'User 2 Note',
    content: 'Private note belonging to User 2.',
    visibility: 'private' as const,
  },
  {
    id: 3,
    userId: 3,
    title: 'Admin Note',
    content: 'Private note belonging to Admin.',
    visibility: 'private' as const,
  },
  {
    id: 4,
    userId: 1,
    title: 'Shared lab notice',
    content: 'This notice is intentionally public in the ownership fixture.',
    visibility: 'public' as const,
  },
] as const;

export const INTERNAL_NOTES_FETCH_CAP = 50;
