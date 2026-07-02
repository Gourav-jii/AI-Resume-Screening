# TODO - Fix data privacy with JWT + MongoDB user isolation

## Step 1: Backend auth + schema
- [x] Add `jsonwebtoken` usage.
- [x] Add JWT middleware (`requireAuth`) to attach `req.user`.
- [x] Add `userId` to `ResumeData` schema + index.

## Step 2: Backend route isolation
- [x] Update `/api/candidates` to return only documents for `req.user.userId`.
- [x] Update `/api/candidates/:id/status`, `/api/candidates/:id` and `/api/candidates/:id/download` to enforce ownership.
- [x] Update `/api/candidates/save` to set `userId` from JWT and ignore any client-provided value.

## Step 3: Frontend auth plumbing
- [x] Update login flow to store JWT token and user info in localStorage.
- [x] Update `Candidates.jsx` + `Shortlisted.jsx` to send `Authorization: Bearer <token>` on all candidate API calls.
- [x] Update `App.jsx` to keep token in state / read from localStorage.

## Step 4: Verification
- [ ] Start backend, login as two users.
- [ ] Upload resumes as user A and ensure user B cannot see them.
- [ ] Verify download/status/delete all fail for non-owner.

