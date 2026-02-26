import { Page } from "playwright";

export class LoginPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.setViewportSize({ width: 1366, height: 728 });
    await this.page.goto(process.env.URL!);
  }

  async login(username: string, password: string) {
    const usernameInput = this.page.locator("//input[@name='username']");
    const passwordInput = this.page.locator("//input[@name='password']");
    const loginButton = this.page.locator("//button[@type='submit']");

    await usernameInput.waitFor({ state: "visible" });
    await usernameInput.fill(username);

    await passwordInput.waitFor({ state: "visible" });
    await passwordInput.fill(password);

    await loginButton.waitFor({ state: "visible" });
    await loginButton.click();
  }
}