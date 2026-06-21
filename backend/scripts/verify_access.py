"""
Access-control smoke test for the 2LTP backend.

Verifies platform (portal) isolation and role-based data access against a
running backend. Uses only the standard library so it can run inside the
backend container with no extra dependencies:

    docker compose exec backend python scripts/verify_access.py

Requires the database to be seeded (`python -m app.seed`).
"""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"

ACCOUNTS = {
    "admin":   ("admin@2ltp.ru",   "Admin123!"),
    "manager": ("manager@2ltp.ru", "Manager123!"),
    "worker":  ("worker1@2ltp.ru", "Worker123!"),
    "client":  ("client@2ltp.ru",  "Client123!"),
}

_passed = 0
_failed = 0


def _request(method, path, *, body=None, cookie=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            set_cookie = resp.headers.get("Set-Cookie", "")
            return resp.status, set_cookie
    except urllib.error.HTTPError as e:
        return e.code, ""


def login(account, portal):
    email, password = ACCOUNTS[account]
    return _request("POST", "/api/auth/login",
                    body={"email": email, "password": password, "portal": portal})


def check(label, got, expected):
    global _passed, _failed
    ok = got == expected
    if ok:
        _passed += 1
    else:
        _failed += 1
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {label}: got {got}, expected {expected}")


print("== Portal isolation at login ==")
# Client portal admits clients only
check("client account  -> client portal",  login("client",  "client")[0], 200)
check("admin account   -> client portal",  login("admin",   "client")[0], 403)
check("manager account -> client portal",  login("manager", "client")[0], 403)
check("worker account  -> client portal",  login("worker",  "client")[0], 403)
# Internal portal admits staff only
check("admin account   -> internal portal", login("admin",   "internal")[0], 200)
check("manager account -> internal portal", login("manager", "internal")[0], 200)
check("worker account  -> internal portal", login("worker",  "internal")[0], 200)
check("client account  -> internal portal", login("client",  "internal")[0], 403)

print("\n== Role-based data access ==")
# Client session: cannot read internal tasks, can read own tickets
_, client_cookie = login("client", "client")
client_cookie = client_cookie.split(";")[0] if client_cookie else None
check("client GET /api/tasks/   (staff-only)", _request("GET", "/api/tasks/",   cookie=client_cookie)[0], 403)
check("client GET /api/tickets/ (own)",        _request("GET", "/api/tickets/", cookie=client_cookie)[0], 200)
check("client GET /api/users/   (admin-only)", _request("GET", "/api/users/",   cookie=client_cookie)[0], 403)

# Worker session: can read tasks, cannot manage users
_, worker_cookie = login("worker", "internal")
worker_cookie = worker_cookie.split(";")[0] if worker_cookie else None
check("worker GET /api/tasks/   (staff)",      _request("GET", "/api/tasks/",   cookie=worker_cookie)[0], 200)
check("worker GET /api/users/   (admin-only)", _request("GET", "/api/users/",   cookie=worker_cookie)[0], 403)

# Admin session: full management access
_, admin_cookie = login("admin", "internal")
admin_cookie = admin_cookie.split(";")[0] if admin_cookie else None
check("admin  GET /api/users/   (admin)",      _request("GET", "/api/users/",   cookie=admin_cookie)[0], 200)

print(f"\n== {_passed} passed, {_failed} failed ==")
raise SystemExit(1 if _failed else 0)
