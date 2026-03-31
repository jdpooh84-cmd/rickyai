#!/usr/bin/env python3
"""
Deployment Verifier — Post-deploy health checker for routes and edge functions.

Usage:
  python verify_deploy.py --base-url https://your-app.example.com --manifest /tmp/routes.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests library not available"}))
    sys.exit(1)

ERROR_SIGNATURES = [
    "Internal Server Error",
    "500 Internal Server Error",
    "Application Error",
    "503 Service Unavailable",
    "502 Bad Gateway",
    "FATAL ERROR",
    "Unexpected token",
    "Cannot read properties of undefined",
    "Cannot read property",
    "ReferenceError",
    "TypeError:",
    "SyntaxError:",
    "Module not found",
    "ECONNREFUSED",
    "relation .* does not exist",
]


def check_route(base_url, route, auth_redirect_routes=None, timeout=15):
    """Check a single route for health."""
    url = base_url.rstrip("/") + route
    result = {
        "route": route,
        "url": url,
        "status": None,
        "timing_ms": None,
        "content_type": None,
        "content_length": None,
        "error_strings_found": [],
        "redirect_location": None,
        "passed": False,
        "notes": [],
    }

    try:
        start = time.perf_counter()
        resp = requests.get(url, timeout=timeout, allow_redirects=False)
        elapsed = round((time.perf_counter() - start) * 1000, 1)

        result["status"] = resp.status_code
        result["timing_ms"] = elapsed
        result["content_type"] = resp.headers.get("content-type", "")
        result["content_length"] = len(resp.content)

        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("location", "")
            result["redirect_location"] = location

            if auth_redirect_routes and route in auth_redirect_routes:
                result["passed"] = True
                result["notes"].append(f"Expected auth redirect → {location}")
            else:
                result["notes"].append(f"Unexpected redirect → {location}")
                try:
                    final = requests.get(url, timeout=timeout, allow_redirects=True)
                    if final.status_code == 200:
                        result["passed"] = True
                        result["notes"].append("Final destination returned 200")
                    else:
                        result["notes"].append(f"Final destination returned {final.status_code}")
                except Exception:
                    pass
            return result

        if resp.status_code == 200:
            body_text = resp.text[:5000]
            for sig in ERROR_SIGNATURES:
                if sig.lower() in body_text.lower():
                    result["error_strings_found"].append(sig)

            if result["error_strings_found"]:
                result["notes"].append(f"Found {len(result['error_strings_found'])} error signatures in body")
            else:
                result["passed"] = True

        elif resp.status_code == 404:
            result["notes"].append("Route returned 404 — may not be deployed or may be a client-side route")
        else:
            result["notes"].append(f"Unexpected status code: {resp.status_code}")

    except requests.exceptions.Timeout:
        result["notes"].append(f"Timed out after {timeout}s")
    except requests.exceptions.ConnectionError as e:
        result["notes"].append(f"Connection failed: {str(e)[:200]}")
    except Exception as e:
        result["notes"].append(f"Unexpected error: {str(e)[:200]}")

    return result


def check_edge_function(base_url, func_spec, supabase_url=None, anon_key=None, timeout=30):
    """Check a single edge function endpoint."""
    name = func_spec["name"]
    method = func_spec.get("method", "POST").upper()
    test_body = func_spec.get("test_body", {})

    if supabase_url:
        url = f"{supabase_url}/functions/v1/{name}"
    else:
        url = f"{base_url.rstrip('/')}/functions/v1/{name}"

    result = {
        "function": name,
        "url": url,
        "method": method,
        "status": None,
        "timing_ms": None,
        "content_type": None,
        "response_preview": None,
        "passed": False,
        "notes": [],
    }

    headers = {"Content-Type": "application/json"}
    if anon_key:
        headers["Authorization"] = f"Bearer {anon_key}"
        headers["apikey"] = anon_key

    for k, v in func_spec.get("headers", {}).items():
        headers[k] = v

    try:
        start = time.perf_counter()
        if method in ("POST", "PUT", "PATCH"):
            resp = requests.request(method, url, json=test_body, headers=headers, timeout=timeout)
        else:
            resp = requests.request(method, url, headers=headers, timeout=timeout)
        elapsed = round((time.perf_counter() - start) * 1000, 1)

        result["status"] = resp.status_code
        result["timing_ms"] = elapsed
        result["content_type"] = resp.headers.get("content-type", "")

        try:
            body = resp.json()
            preview = json.dumps(body, default=str)[:500]
        except (json.JSONDecodeError, ValueError):
            preview = resp.text[:500]
        result["response_preview"] = preview

        if resp.status_code in (200, 201, 202):
            result["passed"] = True
        elif resp.status_code == 401:
            result["notes"].append("Auth required — function exists but test lacks valid credentials")
            result["passed"] = True
        elif resp.status_code == 404:
            result["notes"].append("Function not found — may not be deployed")
        elif resp.status_code == 500:
            result["notes"].append("Internal server error in function")
        else:
            result["notes"].append(f"Status: {resp.status_code}")

    except requests.exceptions.Timeout:
        result["notes"].append(f"Timed out after {timeout}s")
    except requests.exceptions.ConnectionError as e:
        result["notes"].append(f"Connection failed: {str(e)[:200]}")
    except Exception as e:
        result["notes"].append(f"Unexpected error: {str(e)[:200]}")

    return result


def generate_markdown_report(report_data):
    """Generate a markdown health report."""
    lines = [
        "# Deployment Health Report",
        "",
        f"**Base URL:** {report_data['base_url']}",
        f"**Timestamp:** {report_data['timestamp']}",
        f"**Overall:** {'✅ PASS' if report_data['overall_pass'] else '❌ FAIL'}",
        f"**Routes:** {report_data['routes_passed']}/{report_data['routes_total']} passed",
        f"**Edge Functions:** {report_data['functions_passed']}/{report_data['functions_total']} passed",
        f"**Total Time:** {report_data['total_timing_ms']}ms",
        "",
        "## Routes",
        "",
        "| Route | Status | Time (ms) | Result | Notes |",
        "|-------|--------|-----------|--------|-------|",
    ]

    for r in report_data["route_results"]:
        icon = "✅" if r["passed"] else "❌"
        notes = "; ".join(r["notes"]) if r["notes"] else ""
        errors = ", ".join(r.get("error_strings_found", []))
        if errors:
            notes = f"Errors: {errors}. {notes}" if notes else f"Errors: {errors}"
        lines.append(f"| `{r['route']}` | {r['status'] or '—'} | {r['timing_ms'] or '—'} | {icon} | {notes} |")

    lines.extend(["", "## Edge Functions", "", "| Function | Method | Status | Time (ms) | Result | Notes |",
                   "|----------|--------|--------|-----------|--------|-------|"])

    for f_result in report_data["function_results"]:
        icon = "✅" if f_result["passed"] else "❌"
        notes = "; ".join(f_result["notes"]) if f_result["notes"] else ""
        lines.append(f"| `{f_result['function']}` | {f_result['method']} | {f_result['status'] or '—'} | {f_result['timing_ms'] or '—'} | {icon} | {notes} |")

    # Failures section
    failures = [r for r in report_data["route_results"] + report_data["function_results"] if not r["passed"]]
    if failures:
        lines.extend(["", "## ⚠️ Failures Requiring Attention", ""])
        for f in failures:
            name = f.get("route") or f.get("function", "Unknown")
            notes = "; ".join(f.get("notes", [])) or "Unknown issue"
            lines.append(f"- **{name}**: {notes}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Deployment Verifier — Post-deploy health checker")
    parser.add_argument("--base-url", required=True, help="Base URL of the deployed app")
    parser.add_argument("--manifest", required=True, help="Path to route manifest JSON")
    parser.add_argument("--supabase-url", help="Separate Supabase URL for edge functions")
    parser.add_argument("--anon-key", help="Supabase anon key for function auth headers")
    parser.add_argument("--timeout", type=int, default=15, help="Per-request timeout in seconds (default: 15)")
    parser.add_argument("--output", "-o", help="File path to write report")
    parser.add_argument("--format", choices=["json", "markdown"], default="json", help="Output format")

    args = parser.parse_args()

    try:
        with open(args.manifest, "r") as f:
            manifest = json.load(f)
    except FileNotFoundError:
        print(json.dumps({"error": f"Manifest not found: {args.manifest}"}))
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON in manifest: {e}"}))
        sys.exit(1)

    routes = manifest.get("routes", [])
    edge_functions = manifest.get("edge_functions", [])
    auth_redirects = manifest.get("expected_auth_redirects", [])

    print(f"Verifying deployment at: {args.base_url}")
    print(f"  Routes to check: {len(routes)}")
    print(f"  Edge functions to check: {len(edge_functions)}")
    print(f"  Expected auth redirects: {len(auth_redirects)}")
    print()

    route_results = []
    for route in routes:
        print(f"  Checking route: {route} ...", end=" ", flush=True)
        result = check_route(args.base_url, route, auth_redirects, args.timeout)
        icon = "PASS" if result["passed"] else "FAIL"
        print(f"{icon} ({result['status'] or 'ERR'}, {result['timing_ms'] or '?'}ms)")
        route_results.append(result)

    function_results = []
    for func in edge_functions:
        print(f"  Checking function: {func['name']} ...", end=" ", flush=True)
        result = check_edge_function(
            args.base_url, func,
            supabase_url=args.supabase_url,
            anon_key=args.anon_key,
            timeout=args.timeout
        )
        icon = "PASS" if result["passed"] else "FAIL"
        print(f"{icon} ({result['status'] or 'ERR'}, {result['timing_ms'] or '?'}ms)")
        function_results.append(result)

    routes_passed = sum(1 for r in route_results if r["passed"])
    functions_passed = sum(1 for f in function_results if f["passed"])
    total_timing = sum((r.get("timing_ms") or 0) for r in route_results + function_results)

    report = {
        "base_url": args.base_url,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_pass": routes_passed == len(routes) and functions_passed == len(edge_functions),
        "routes_total": len(routes),
        "routes_passed": routes_passed,
        "functions_total": len(edge_functions),
        "functions_passed": functions_passed,
        "total_timing_ms": round(total_timing, 1),
        "route_results": route_results,
        "function_results": function_results,
    }

    print()
    print(f"{'=' * 50}")
    print(f"  RESULT: {'PASS' if report['overall_pass'] else 'FAIL'}")
    print(f"  Routes: {routes_passed}/{len(routes)} passed")
    print(f"  Functions: {functions_passed}/{len(edge_functions)} passed")
    print(f"  Total time: {report['total_timing_ms']}ms")
    print(f"{'=' * 50}")

    if args.format == "markdown":
        output_str = generate_markdown_report(report)
    else:
        output_str = json.dumps(report, indent=2, default=str)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w") as f:
            f.write(output_str)
        print(f"\nReport written to {args.output}")
    else:
        print(f"\n{output_str}")


if __name__ == "__main__":
    main()
