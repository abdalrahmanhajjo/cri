# Client Authentication Module Report

This section describes the client-side authentication module of the Visit Tripoli web application. The module allows users to create an account, log in, verify their email address, and reset a forgotten password. It is built with React and communicates with the backend through API functions.

## Module Purpose

The authentication client is responsible for managing the user interface and frontend logic for account access. It collects user input, validates basic fields, sends requests to the backend, handles success and error responses, saves the login session, and redirects users to the correct page after authentication.

The main authentication files are:

- `Login.jsx`: handles user login and Google sign-in.
- `Register.jsx`: handles account creation.
- `VerifyEmail.jsx`: handles email verification using a 6-digit code.
- `ForgotPassword.jsx`: handles password reset using an email code.
- `AuthContext.jsx`: stores and shares authentication state across the app.
- `api/auth.js`: contains the API functions used by the auth pages.

## Authentication API Functions

### `login(email, password)`

The login function sends the user's email or username and password to the backend. If the details are correct, the backend returns a token and user information. The client then stores the token, saves the user data, updates the authentication state, and redirects the user to the page they were trying to access.

If the account exists but the email is not verified, the login page shows a message and provides a button that sends the user to the email verification page.

### `google(credential)`

This function supports Google sign-in. The client receives a credential token from Google and sends it to the backend. The backend verifies the Google credential and returns a normal application session if the sign-in is valid.

The login page also handles Google setup problems, such as a missing Google client ID, blocked Google script, or mismatched Google account.

### `register(name, username, email, password)`

The register function creates a new account. Before submitting, the client checks that the username follows the correct format, that the username is available, that the password is strong enough, and that the confirmation password matches.

After successful registration, the backend sends a verification code to the user's email. The client then redirects the user to the email verification page with the email already filled in.

### `checkUsername(username)`

This function checks whether a username is available before the user submits the registration form. The client waits briefly while the user is typing before calling this function, which avoids sending too many requests to the server.

The result is shown directly in the form as one of these states:

- checking availability
- username available
- username already taken
- unable to check username

### `verifyEmail(email, code)`

This function verifies a new account. The user enters their email and the 6-digit code received by email. The client sends both values to the backend.

If the code is correct, the backend returns a token and user object. The client applies the session, logs the user in automatically, stores a temporary welcome message, and redirects the user to the home page.

### `forgotPassword(email)`

This function starts the password reset process. The user enters their email, and the client asks the backend to send a reset code.

For security, the success message does not reveal whether the email exists in the system. This helps prevent attackers from discovering registered email addresses.

### `resetPassword(email, code, newPassword)`

This function completes the password reset process. The user enters the reset code and a new password. The client checks that the new password follows the password rules and that the confirmation password matches.

If the reset succeeds, the page shows a success message and gives the user a link back to the login page.

## Authentication Context Functions

### `login`

The `login` function in `AuthContext.jsx` calls the login API, receives the token and user data, and stores them in local storage. It also updates the React state so the whole application knows the user is logged in.

### `loginWithGoogle`

This function works like the normal login function, but it uses a Google credential instead of an email and password. After the backend verifies the credential, the user is logged into the application.

### `register`

The context `register` function calls the backend registration endpoint and returns information about the created account and whether the verification email was delivered. It does not log the user in immediately because email verification is required first.

### `applySession`

This function is used after successful email verification. It receives a token and user object from the backend, saves them, and updates the app state. This automatically logs the user in after verifying their email.

### `logout`

The logout function clears the token, user data, and session code from local storage. It also updates React state so the app returns to a logged-out state.

### `refreshUser`

This function requests the latest profile data from the backend and updates the stored user information. It helps keep the client state synchronized with the server.

## Login Page Description

The login page allows users to sign in using either email/username and password or Google sign-in. It uses form state to store the entered email and password, displays loading indicators while requests are running, and shows error messages when authentication fails.

The page also protects the redirect flow. If a user was sent to login from a protected page, the app remembers that page and returns the user there after successful login. The redirect is checked to make sure it is an internal route, which prevents unsafe external redirects.

If the backend reports that the account email has not been verified, the page displays a verification action so the user can enter their 6-digit email code.

## Register Page Description

The register page allows a new user to create an account using full name, username, email, password, and password confirmation.

The page performs live validation before submission. It checks username rules, asks the backend whether the username is available, checks password strength, and verifies that both password fields match. The create account button remains disabled until all required conditions are valid.

After a successful registration, the user is redirected to the verification page. This ensures that only verified email accounts can log in and use protected parts of the application.

## Verify Email Page Description

The verify email page confirms a new user's email address. It accepts the user's email and a 6-digit verification code. The email can be automatically filled from the URL when the user arrives from the registration or login page.

When the user submits the form, the client sends the email and code to the backend. If the code is valid, the backend returns a login session. The client saves the session and redirects the user to the home page.

The page also supports a development warning when email delivery is not configured on the server. In that case, it tells the operator to check the backend server log or configure SMTP.

## Forgot Password Page Description

The forgot password page is divided into three steps.

First, the user enters their email address and requests a reset code. Second, the user enters the received 6-digit code and chooses a new password. Third, the page displays a success message after the password has been changed.

The reset form uses the same password strength rules as registration. It prevents submission until the code is 6 digits, the new password is valid, and the confirmation password matches.

The page also handles rate limit messages from the backend. If the user requests too many codes or submits too many wrong codes, the client shows how long they should wait before trying again.

## Password Validation

The client includes password validation to improve user experience before sending data to the backend. A valid password must contain:

- at least 8 characters
- one uppercase letter
- one lowercase letter
- one number
- one special character
- no long repeated character sequence

These checks are only for frontend feedback. The backend must still validate the password because client-side validation can be bypassed.

## Username Validation

The username validation checks that the username:

- has at least 3 characters
- has at most 30 characters
- starts with a letter
- contains only lowercase letters, numbers, and underscores
- is not a reserved name such as `admin`, `support`, or `tripoli`
- is available in the database

This validation gives immediate feedback to the user and reduces failed registration attempts.

## Session Management

After login or email verification, the client stores the authentication token and user information in local storage. This allows the user to stay logged in after refreshing the page.

When the app starts, `AuthContext` checks whether a saved token exists. If it exists, the client requests the user profile from the backend to confirm that the session is still valid. If the token is expired, invalid, blocked, or belongs to an unverified account, the client clears the stored session and logs the user out.

The app also checks token expiration regularly and listens for global authentication-expired events from the API layer.

## Routing and Protection

The app defines public routes for login, registration, email verification, and forgot password. Protected pages are wrapped with a route guard. If the user tries to open a protected page without being logged in, the app redirects them to `/login`.

After the user logs in successfully, the app returns them to the page they originally wanted to open.

## Summary

The client authentication module provides a complete account access flow for the Visit Tripoli web app. It handles login, registration, email verification, Google sign-in, password reset, input validation, session storage, route protection, and user feedback. The frontend improves usability with live validation and clear messages, while the backend remains responsible for final security validation and account management.

