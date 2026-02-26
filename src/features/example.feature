Feature: Login functionality

  Scenario: Login with valid credentials
    Given I navigate to login page
    When I login with "valid" credentials
    Then I should see the home page
  
  Scenario: Login with Invalid Username
    Given I navigate to login page
    When I login with "invalidUser" credentials
    Then I should not see the home page

  Scenario: Login with invalid Password
    Given I navigate to login page
    When I login with "invalidPass" credentials
    Then I should not see the home page

  Scenario: Login with Invalid credentials
    Given I navigate to login page
    When I login with "invalid" credentials
    Then I should not see the home page