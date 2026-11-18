const form = document.querySelector('.login-form');
const error = document.querySelector('.login-error');
const submit = document.querySelector('.login-submit');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const { username, password } = form.elements;
  if (!username.value.trim() || !password.value) {
    error.textContent = 'Enter your username and password';
    return;
  }
  submit.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not log in');
    location.replace('./');
  } catch (failure) {
    error.textContent = failure.message;
    password.value = '';
    password.focus();
  } finally {
    submit.disabled = false;
  }
});
