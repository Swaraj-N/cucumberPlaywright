import axios from "axios";
import fs from "fs";
const hierarchyFile = "qtest-hierarchy.json";
import {
  BeforeAll,
  Before,
  After,
  ITestCaseHookParameter,
} from "@cucumber/cucumber";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { CustomWorld } from "../support/world";

import dotenv from "dotenv";
dotenv.config();

/* ================= ENV ================= */

const QTEST_BASE_URL = process.env.QTEST_URL!;
const TOKEN = process.env.QTEST_TOKEN!;
const PROJECT_NAME = process.env.QTEST_PROJECT_NAME!;
const RELEASE_NAME = process.env.QTEST_RELEASE_NAME!;
const MODULE_NAME = process.env.MODULE_NAME!;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

/* ================= STATUS MAPPER ================= */

function mapStatus(status?: string): number {
  switch (status) {
    case "PASSED":
      return 601;
    case "FAILED":
      return 602;
    case "SKIPPED":
      return 605;
    case "AMBIGUOUS":
      return 602;
    case "UNDEFINED":
      return 602;
    case "PENDING":
      return 605;
    default:
      return 602;
  }
}

/* ================= TIME UTILITY ================= */

function getAustraliaTimeISO() {
  const now = new Date();
  const auDate = now.toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    hour12: false,
  });

  const [datePart, timePart] = auDate.split(", ");
  const [day, month, year] = datePart.split("/");

  return `${year}-${month}-${day}T${timePart}`;
}

/* ================= GLOBAL STATE ================= */

let PROJECT_ID: number;
let RELEASE_ID: number;
let cycleId: number;
let suiteId: number;
let runId: number;
let moduleId: number;
let testCaseMap: Map<string, number> = new Map();

/* ================= API HELPERS ================= */

async function fetchProjectId(): Promise<number> {
  const res = await axios.get(`${QTEST_BASE_URL}/api/v3/projects`, { headers });

  const project = res.data.find((p: any) => p.name === PROJECT_NAME);

  if (!project) {
    throw new Error(`Project '${PROJECT_NAME}' not found`);
  }

  return project.id;
}

async function fetchReleaseId(projectId: number): Promise<number> {
  const res = await axios.get(
    `${QTEST_BASE_URL}/api/v3/projects/${projectId}/releases`,
    { headers },
  );

  const release = res.data.find((r: any) => r.name === RELEASE_NAME);

  if (!release) {
    throw new Error(`Release '${RELEASE_NAME}' not found`);
  }

  return release.id;
}

async function fetchModuleId(): Promise<number> {
  const res = await axios.get(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/modules`,
    { headers },
  );

  const module = res.data.find((m: any) => m.name === MODULE_NAME);

  if (!module) {
    throw new Error(`Module '${MODULE_NAME}' not found`);
  }

  return module.id;
}

async function fetchTestCases(moduleId: number) {
  const res = await axios.get(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-cases?parentId=${moduleId}&expandSteps=true`,
    { headers },
  );

  res.data.forEach((tc: any) => {
    testCaseMap.set(tc.name, tc.id);
  });

  console.log(`Loaded ${testCaseMap.size} test cases from module`);
}

async function createTestCycle() {
  const date = getAustraliaTimeISO();

  const res = await axios.post(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-cycles?parentId=${RELEASE_ID}&parentType=release`,
    { name: `Auto Cycle - ${date}` },
    { headers },
  );

  return res.data.id;
}

async function createTestSuite(cycleId: number) {
  const date = getAustraliaTimeISO();

  const res = await axios.post(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-suites?parentId=${cycleId}&parentType=test-cycle`,
    { name: `Auto Suite - ${date}` },
    { headers },
  );

  return res.data.id;
}

/* async function createTestRun(
  suiteId: number,
  testCaseId: number,
  title: string,
) {
  const res = await axios.post(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-runs?parentId=${suiteId}&parentType=test-suite`,
    {
      name: `Playwright Run - ${title}`,
      test_case: { id: testCaseId },
    },
    { headers },
  );

  return res.data.id;
} */

async function createTestRun(
  suiteId: number,
  testCaseId: number,
  title: string,
) {
  const runName = `Playwright Run - ${title}`;

  // Fetch all runs in this suite
  const res = await axios.get(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-runs?parentType=test-suite&parentId=${suiteId}`,
    { headers }
  );

  const runs = Array.isArray(res.data.items) ? res.data.items : [];

  // Find existing run by name
  const existingRun = runs.filter(
    (r: any) => r.name === runName
  )[0];

  if (existingRun) {
    console.log(`Using existing test run for "${title}" with ID: ${existingRun.id}`);
    return existingRun.id;
  }

  // Create new run if not found
  const createRes = await axios.post(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-runs?parentId=${suiteId}&parentType=test-suite`,
    {
      name: runName,
      test_case: { id: testCaseId },
    },
    { headers }
  );

  console.log(`Created new test run for "${title}" with ID: ${createRes.data.id}`);
  return createRes.data.id;
}

async function createTestLog(runId: number, status: number, note = "") {
  const exeStart = getAustraliaTimeISO();
  const exeEnd = getAustraliaTimeISO();

  await axios.post(
    `${QTEST_BASE_URL}/api/v3/projects/${PROJECT_ID}/test-runs/${runId}/test-logs`,
    {
      exe_start_date: exeStart,
      exe_end_date: exeEnd,
      status: { id: status },
      note,
    },
    { headers },
  );
}

/* ================= CUCUMBER HOOKS ================= */

/* Before All Scenarios */
BeforeAll(async function () {
  let hierarchyExists = false;

  // STEP 1: Check if file exists
  if (fs.existsSync(hierarchyFile)) {
    const data = JSON.parse(fs.readFileSync(hierarchyFile, "utf-8"));

    cycleId = data.cycleId;
    suiteId = data.suiteId;

    hierarchyExists = true;

    console.log("Using existing cycle & suite from file");
  }

  // STEP 2: Always resolve base data
  PROJECT_ID = await fetchProjectId();
  console.log(`Resolved Project ID: ${PROJECT_ID}`);

  RELEASE_ID = await fetchReleaseId(PROJECT_ID);
  console.log(`Resolved Release ID: ${RELEASE_ID}`);

  moduleId = await fetchModuleId();
  await fetchTestCases(moduleId);

  // STEP 3: Create only if NOT exists
  if (!hierarchyExists) {
    cycleId = await createTestCycle();
    suiteId = await createTestSuite(cycleId);

    fs.writeFileSync(
      hierarchyFile,
      JSON.stringify({ cycleId, suiteId }, null, 2)
    );

    console.log("Created new cycle & suite and saved to file");
  }

  console.log("Cycle, Suite & Test Case Map Ready");
});

/* Before Each Scenario */
Before(async function (this: CustomWorld, scenario) {
  this.browser = await chromium.launch({ headless: false });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();

  // Normalize title
  const rawTitle = scenario.pickle.name;
  const title = rawTitle.replace(/\(retry.*\)/i, "").trim();

  const testCaseId = testCaseMap.get(title);

  if (!testCaseId) {
    throw new Error(`Test case not found in qTest module: ${title}`);
  }

  runId = await createTestRun(suiteId, testCaseId, title);

  console.log(`Run created for TC ID: ${testCaseId}`);
});

/* After Each Scenario */
After(async function (this: CustomWorld, scenario) {
  const title = scenario.pickle.name;

  const mappedStatus = mapStatus(scenario.result?.status);

  const rawMessage = scenario.result?.message || "";

  let cleanedMessage = rawMessage;

  // Remove stack trace
  cleanedMessage = cleanedMessage.split("\n    at ")[0];

  // Remove call log section
  cleanedMessage = cleanedMessage.split("Call log:")[0];

  await createTestLog(
    runId,
    mappedStatus,
    cleanedMessage.trim() || "Executed via Cucumber + Playwright",
  );

  await this.context?.close();
  await this.browser?.close();

  console.log(`Result pushed for ${title}`);
});
