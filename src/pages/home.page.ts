import { Page, expect } from "@playwright/test";

export class HomePage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async verifyHomePage() {
    await expect(
      this.page.locator("//h3[text()='Ninza-HRM']")
    ).toHaveText("Ninza-HRM", {
      timeout: 2000
    });
  }
}