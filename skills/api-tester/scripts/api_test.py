#!/usr/bin/env python3
"""
API Tester — Authenticated HTTP request tool with chaining support.

Usage:
  Single request:
    python api_test.py POST https://example.com/api \
      --header "Authorization: Bearer tok_xxx" \
      --header "Content-Type: application/json" \
      --body '{"key": "value"}' \
      --timeout 30

  Chain mode:
    python api_test.py --chain /tmp/chain-spec.json

Output:
  JSON to stdout with status, timing, headers, body, curl_equivalent.
"""

import argparse
import json
import os
import re
import sys
import time

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests library not available. Install with: pip install requests"}))
    sys.exit(1)


def build_curl(method, url, headers, body):
    """Build a curl-equivalent command string for debugging."""
    parts = [f"curl -X {method.upper()}"]
    for k, v in (headers or {}).items():
        parts.append(f'-H "{k}: {v}"')
    if body:
        escaped = json.dumps(body) if isinstance(body, (dict, list)) else str(body)
        parts.append(f"-d '{escaped}'")
    parts.append(f'"{url}"')
    return " \\\n   ".join(parts)


def execute_request(method, url, headers=None, body=None, timeout=30):
    """Execute a single HTTP request and return structured results."""
    method = method.upper()
    headers = headers or {}
    result = {
        "method": method,
        "url": url,
        "status": None,
        "timing_ms": None,
        "headers": {},
        "body": None,
        "body_raw": None,
        "error": None,
        "curl_equivalent": build_curl(method, url, headers, body),
    }

    kwargs = {"headers": headers, "timeout": timeout}
    if body is not None and method in ("POST", "PUT", "PATCH"):
        content_type = headers.get("Content-Type", headers.get("content-type", ""))
        if "json" in content_type or isinstance(body, (dict, list)):
            kwargs["json"] = body
        else:
            kwargs["data"] = body if isinstance(body, str) else json.dumps(body)

    try:
        start = time.perf_counter()
        resp = requests.request(method, url, **kwargs)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)

        result["status"] = resp.status_code
        result["timing_ms"] = elapsed_ms
        result["headers"] = dict(resp.headers)

        ct = resp.headers.get("content-type", "")
        if "json" in ct:
            try:
                result["body"] = resp.json()
            except (json.JSONDecodeError, ValueError):
                result["body"] = resp.text
            result["body_raw"] = resp.text
        else:
            result["body"] = resp.text
            result["body_raw"] = resp.text

        if isinstance(result.get("body_raw"), str) and len(result["body_raw"]) > 10000:
            result["body_raw"] = result["body_raw"][:10000] + "\n... [truncated]"

    except requests.exceptions.Timeout:
        result["error"] = f"Request timed out after {timeout}s"
    except requests.exceptions.ConnectionError as e:
        result["error"] = f"Connection error: {e}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Request failed: {e}"

    return result


def resolve_variables(obj, variables):
    """Recursively replace {{var}} placeholders in strings within dicts/lists."""
    if isinstance(obj, str):
        def replacer(match):
            key = match.group(1).strip()
            return str(variables.get(key, match.group(0)))
        return re.sub(r"\{\{(.+?)\}\}", replacer, obj)
    elif isinstance(obj, dict):
        return {k: resolve_variables(v, variables) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [resolve_variables(item, variables) for item in obj]
    return obj


def extract_value(data, path):
    """Extract a value from nested dict/list using dot notation (e.g., 'data.0.id')."""
    parts = path.split(".")
    current = data
    for part in parts:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current


def run_chain(chain_spec):
    """Execute a chain of requests with variable extraction between steps."""
    variables = dict(chain_spec.get("variables", {}))
    for k, v in os.environ.items():
        if k.startswith("CHAIN_"):
            variables[k] = v

    steps = chain_spec.get("steps", [])
    results = []
    all_passed = True

    for i, step in enumerate(steps):
        step_name = step.get("name", f"Step {i + 1}")
        resolved = resolve_variables(step, variables)

        method = resolved.get("method", "GET")
        url = resolved.get("url", "")
        headers = resolved.get("headers", {})
        body = resolved.get("body")
        timeout = resolved.get("timeout", 30)

        result = execute_request(method, url, headers, body, timeout)
        result["step_name"] = step_name
        result["step_index"] = i

        expected_status = step.get("assert_status")
        if expected_status and result["status"] != expected_status:
            result["assertion_failed"] = f"Expected status {expected_status}, got {result['status']}"
            all_passed = False

        extractions = step.get("extract", {})
        for var_name, path in extractions.items():
            source = path.split(".", 1)
            if source[0] == "body" and len(source) > 1:
                value = extract_value(result.get("body"), source[1])
            elif source[0] == "headers" and len(source) > 1:
                value = result.get("headers", {}).get(source[1])
            elif source[0] == "status":
                value = result.get("status")
            else:
                value = extract_value(result.get("body"), path)

            if value is not None:
                variables[var_name] = value
                result.setdefault("extracted", {})[var_name] = value
            else:
                result.setdefault("extraction_warnings", []).append(
                    f"Could not extract '{var_name}' from path '{path}'"
                )

        results.append(result)

        if step.get("stop_on_error", False) and result.get("error"):
            result["chain_stopped"] = True
            break

    return {
        "chain_result": "PASS" if all_passed else "FAIL",
        "total_steps": len(steps),
        "completed_steps": len(results),
        "total_timing_ms": sum(r.get("timing_ms", 0) or 0 for r in results),
        "variables": variables,
        "steps": results,
    }


def parse_header(header_str):
    """Parse a 'Key: Value' header string."""
    if ":" in header_str:
        k, v = header_str.split(":", 1)
        return k.strip(), v.strip()
    return header_str.strip(), ""


def main():
    parser = argparse.ArgumentParser(
        description="API Tester — Make authenticated HTTP requests with chaining support."
    )
    parser.add_argument("method", nargs="?", help="HTTP method (GET, POST, PUT, DELETE, PATCH)")
    parser.add_argument("url", nargs="?", help="Request URL")
    parser.add_argument("--header", "-H", action="append", default=[], help="Header in 'Key: Value' format")
    parser.add_argument("--body", "-d", help="Request body (JSON string or raw text)")
    parser.add_argument("--body-file", help="Path to file containing request body")
    parser.add_argument("--timeout", "-t", type=int, default=30, help="Timeout in seconds (default: 30)")
    parser.add_argument("--chain", help="Path to chain spec JSON file for multi-step requests")
    parser.add_argument("--output", "-o", help="Write output to file instead of stdout")
    parser.add_argument("--pretty", action="store_true", default=True, help="Pretty-print JSON output")
    parser.add_argument("--compact", action="store_true", help="Compact JSON output")

    args = parser.parse_args()

    # Chain mode
    if args.chain:
        try:
            with open(args.chain, "r") as f:
                chain_spec = json.load(f)
        except FileNotFoundError:
            print(json.dumps({"error": f"Chain spec not found: {args.chain}"}))
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid JSON in chain spec: {e}"}))
            sys.exit(1)

        result = run_chain(chain_spec)

    # Single request mode
    elif args.method and args.url:
        headers = {}
        for h in args.header:
            k, v = parse_header(h)
            headers[k] = v

        body = None
        if args.body:
            try:
                body = json.loads(args.body)
            except json.JSONDecodeError:
                body = args.body
        elif args.body_file:
            try:
                with open(args.body_file, "r") as f:
                    raw = f.read()
                try:
                    body = json.loads(raw)
                except json.JSONDecodeError:
                    body = raw
            except FileNotFoundError:
                print(json.dumps({"error": f"Body file not found: {args.body_file}"}))
                sys.exit(1)

        result = execute_request(args.method, args.url, headers, body, args.timeout)
    else:
        parser.print_help()
        sys.exit(1)

    # Output
    indent = None if args.compact else 2
    output_str = json.dumps(result, indent=indent, default=str)

    if args.output:
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        with open(args.output, "w") as f:
            f.write(output_str)
        print(f"Output written to {args.output}")
    else:
        print(output_str)


if __name__ == "__main__":
    main()
