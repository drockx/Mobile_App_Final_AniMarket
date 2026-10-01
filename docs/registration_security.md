# Registration security

New passwords require 8–21 characters, uppercase, lowercase, a number, and a special symbol. The same policy is enforced in registration and password changes by both the app and API. Passwords are rejected rather than trimmed or truncated.

Email verification is removed for now. Registration needs no code or email delivery provider. Email format and duplicate addresses are still checked; mailbox ownership is not verified. New accounts are not marked email-verified. Email changes require the current password and clear any previous verification timestamp.

Existing passwords remain usable for login. New or changed passwords must meet the updated policy. Firebase remains disconnected.

Run npm run check:auth for password boundaries and registration without email delivery.
