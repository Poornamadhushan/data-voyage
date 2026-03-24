Test Case ID: TC-AUTH-LOGIN-001
Test Case Name: Login with valid credentials
Description: Verify that a valid user can log in and receives a success response.
Preconditions:
- A user exists with is_active=1 and a known password.
Test Steps:
1) Send POST request to /api/auth/login.
2) Body: email, password for the active user.
Test Data:
- email: user@example.com
- password: UserPass123
Expected Result:
- Response status 200 with { ok: true, name, role } and session established.
Actual Result:
- LOGIN_USER_OK=True
Status: PASS

Test Case ID: TC-RESEARCH-LIST-001
Test Case Name: List approved research papers
Description: Verify that only approved papers are returned in the public research list.
Preconditions:
- At least one paper with status='approved' exists.
- At least one paper with status='pending' exists.
Test Steps:
1) Send GET request to /api/research?page=1.
2) Inspect returned papers array.
Test Data:
- page: 1
Expected Result:
- Response status 200.
- Only papers with status='approved' are included.
Actual Result:
- RESEARCH_STATUSES=approved
Status: PASS

Test Case ID: TC-NEWS-LIST-001
Test Case Name: List published news by category
Description: Verify published news filtering by category.
Preconditions:
- At least one published news item exists with category Announcement.
- At least one unpublished item exists.
Test Steps:
1) Send GET request to /api/news?category=Announcement&page=1&limit=9.
2) Inspect returned items.
Test Data:
- category: Announcement
Expected Result:
- Response status 200.
- Only published items with category Announcement are returned.
Actual Result:
- NEWS_COUNT=1;HAS_DRAFT=False
Status: PASS

Test Case ID: TC-ANALYTICS-DASH-001
Test Case Name: Fetch dashboard analytics
Description: Verify analytics endpoint returns trend, domain distribution, radar, and totals.
Preconditions:
- Database has at least one approved paper and one user.
Test Steps:
1) Send GET request to /api/analytics/dashboard.
2) Validate response shape.
Test Data:
- None
Expected Result:
- Response status 200.
- JSON includes trend, domains, radar, totals with expected keys.
Actual Result:
- ANALYTICS_KEYS=True
Status: PASS

Test Case ID: TC-ADMIN-STATS-001
Test Case Name: Admin stats access control
Description: Verify admin-only stats are blocked for non-admin and allowed for admin.
Preconditions:
- One admin user and one researcher user exist.
Test Steps:
1) Login as non-admin; call GET /api/admin/stats.
2) Login as admin; call GET /api/admin/stats.
Test Data:
- Non-admin session
- Admin session
Expected Result:
- Non-admin receives 401/403.
- Admin receives status 200 with counts.
Actual Result:
- ADMIN_NONADMIN=403
- ADMIN_ADMIN=200
Status: PASS

Test Case ID: TC-UI-PAGES-001
Test Case Name: Core UI pages render and navigate
Description: Verify main UI sections load and navigation works.
Preconditions:
- Web app is running and accessible in a browser.
Test Steps:
1) Open the home page /.
2) Verify presence of sections in HTML (#page-repo, #page-dashboards, #page-news, #page-contact).
Test Data:
- None
Expected Result:
- Each page section exists in the rendered HTML.
Actual Result:
- UI_page-repo=True
- UI_page-dashboards=True
- UI_page-news=True
- UI_page-contact=True
Status: PASS
