/** Pure password rules — shared by the server and the change-password form. */
export function passwordProblems(pw: string, minLength = 10, username?: string): string[] {
  const p: string[] = [];
  if (pw.length < minLength) p.push(`at least ${minLength} characters`);
  if (pw.length > 128) p.push("no more than 128 characters");
  if (!/[a-z]/.test(pw)) p.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) p.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) p.push("a number");
  if (!/[^A-Za-z0-9]/.test(pw)) p.push("a symbol");
  if (username && username.length >= 3 && pw.toLowerCase().includes(username.toLowerCase())) p.push("must not contain your username");
  return p;
}
