import { Given, When, Then } from "@cucumber/cucumber";
import { CustomWorld } from "../support/world";
import { LoginPage } from "../pages/login.page";
import { HomePage } from "../pages/home.page";
import dotenv from "dotenv";
dotenv.config();

let loginPage: LoginPage;
let homePage: HomePage;

const credentialsMap: Record<string, { username: string; password: string }> = {
  valid: {
    username: process.env.USER_NAME!,
    password: process.env.PASSWORD!,
  },
  invalid: {
    username: process.env.INVALID_USERNAME!,
    password: process.env.INVALID_PASSWORD!,
  },
  invalidUser:{
    username: process.env.INVALID_USERNAME!,
    password: process.env.PASSWORD!,
  },
  invalidPass:{
    username: process.env.USER_NAME!,
    password: process.env.INVALID_PASSWORD!,
  },
};

Given("I navigate to login page", async function (this: CustomWorld) {
  loginPage = new LoginPage(this.page);
  await loginPage.goto();
});

When("I login with {string} credentials",async function (this: CustomWorld, type: string) {
  
  const creds = credentialsMap[type];
  if (!creds) {
    throw new Error(`Credentials type "${type}" not defined`);
  }
  console.log("Username ",creds.username, "Password ",creds.password);
  await loginPage.login(creds.username, creds.password);
  }
);

Then("I should not see the home page", async function (this: CustomWorld) {
  homePage = new HomePage(this.page);
  await homePage.verifyHomePage();
});

Then("I should see the home page", async function (this: CustomWorld) {
  homePage = new HomePage(this.page);
  await homePage.verifyHomePage();
});
