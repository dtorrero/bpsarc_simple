#!/bin/bash

# Remote Security Check Script for Raspberry Pi Server
# Run from your local machine
# Targets: 192.168.1.43 (HTTP) and xiric.duckdns.org (HTTPS)

TARGET_IP="192.168.1.43"
TARGET_DOMAIN="xiric.duckdns.org"

echo "========================================="
echo "REMOTE SECURITY CHECK - $(date)"
echo "Target IP: $TARGET_IP"
echo "Target Domain: $TARGET_DOMAIN"
echo "========================================="
echo ""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

print_status() {
    if [ "$1" = "PASS" ]; then echo -e "${GREEN}[✓] $2${NC}"
    elif [ "$1" = "WARN" ]; then echo -e "${YELLOW}[!] $2${NC}"
    else echo -e "${RED}[✗] $2${NC}"; fi
}

echo "=== 1. BASIC CONNECTIVITY ==="
echo ""

# Check if server is reachable
ping -c 1 -W 2 $TARGET_IP >/dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status "PASS" "Server $TARGET_IP is reachable"
else
    print_status "FAIL" "Server $TARGET_IP is NOT reachable"
    echo "Aborting - server not reachable"
    exit 1
fi

# Check HTTP (80)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://$TARGET_IP/ 2>/dev/null)
if [ "$HTTP_CODE" != "000" ]; then
    print_status "PASS" "HTTP (80) - Responding (HTTP $HTTP_CODE)"
else
    print_status "FAIL" "HTTP (80) - Not responding"
fi

# Check HTTPS (443)
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://$TARGET_DOMAIN/ -k 2>/dev/null)
if [ "$HTTPS_CODE" != "000" ]; then
    print_status "PASS" "HTTPS (443) - Responding (HTTP $HTTPS_CODE)"
else
    print_status "WARN" "HTTPS (443) - Not responding via domain"
fi

echo ""
echo "=== 2. NGINX SECURITY FILTER TESTS (HTTP) ==="
echo ""

# Test 1: Path traversal (single encoded)
echo -n "Test 1: Path traversal (.%2e) ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://$TARGET_IP/cgi-bin/.%2e/.%2e/bin/sh" 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 2: Double-encoded path traversal
echo -n "Test 2: Double-encoded path traversal ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://$TARGET_IP/cgi-bin/%%32%65%%32%65/%%32%65%%32%65/bin/sh" 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "400" ]; then print_status "PASS" "Blocked (400 - nginx rejects malformed URL)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 3: PHP injection
echo -n "Test 3: PHP injection ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://$TARGET_IP/hello.world?allow_url_include=1" 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 4: Suspicious User-Agent (nikto)
echo -n "Test 4: Suspicious User-Agent (nikto) ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "nikto/1.0" http://$TARGET_IP/ 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 5: Empty User-Agent
echo -n "Test 5: Empty User-Agent ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "" http://$TARGET_IP/ 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 6: libredtail User-Agent (the actual attacker)
echo -n "Test 6: libredtail User-Agent ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "libredtail-http" http://$TARGET_IP/ 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 7: Normal browser should still work
echo -n "Test 7: Normal browser access ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "Mozilla/5.0 (X11; Linux x86_64)" http://$TARGET_IP/ 2>/dev/null)
if [ "$RESULT" = "301" ]; then print_status "PASS" "Redirected to HTTPS (301) - normal traffic works"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "WARN" "Got HTTP $RESULT (expected 301 redirect)"; fi

# Test 8: Docker Registry API probe (/v2/_catalog)
echo -n "Test 8: Docker Registry API probe ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://$TARGET_IP/v2/_catalog" 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test 9: Go-http-client User-Agent
echo -n "Test 9: Go-http-client User-Agent ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "Go-http-client/1.1" http://$TARGET_IP/ 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "301" ]; then print_status "FAIL" "Redirected (301) - filter not applied on HTTP"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

echo ""
echo "=== 3. HTTPS SECURITY TESTS ==="
echo ""

# Test HTTPS path traversal
echo -n "HTTPS: Path traversal ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$TARGET_DOMAIN/cgi-bin/.%2e/.%2e/bin/sh" -k 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test HTTPS PHP injection
echo -n "HTTPS: PHP injection ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$TARGET_DOMAIN/hello.world?allow_url_include=1" -k 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test HTTPS suspicious UA
echo -n "HTTPS: Suspicious UA (nikto) ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 -A "nikto" "https://$TARGET_DOMAIN/" -k 2>/dev/null)
if [ "$RESULT" = "403" ]; then print_status "PASS" "Blocked (403)"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 403)"; fi

# Test HTTPS health endpoint
echo -n "HTTPS: App health check ... "
RESULT=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$TARGET_DOMAIN/api/health" -k 2>/dev/null)
if [ "$RESULT" = "200" ]; then print_status "PASS" "Healthy (200)"
elif [ "$RESULT" = "000" ]; then print_status "FAIL" "Connection failed (000)"
else print_status "FAIL" "Got HTTP $RESULT (expected 200)"; fi

echo ""
echo "=== 4. PORT SCAN (quick) ==="
echo ""

# Quick port scan of common ports
for port in 22 80 443 3000 8096 9091 8123 9090; do
    timeout 2 bash -c "echo >/dev/tcp/$TARGET_IP/$port" 2>/dev/null
    if [ $? -eq 0 ]; then
        case $port in
            22)   print_status "WARN" "Port $port - SSH (consider key-only auth)" ;;
            80)   print_status "PASS" "Port $port - HTTP (nginx)" ;;
            443)  print_status "PASS" "Port $port - HTTPS (nginx)" ;;
            3000) print_status "FAIL" "Port $port - Node.js app exposed! Should be internal only" ;;
            8096) print_status "WARN" "Port $port - Jellyfin exposed" ;;
            9091) print_status "WARN" "Port $port - Transmission Web UI exposed" ;;
            8123) print_status "WARN" "Port $port - Home Assistant exposed" ;;
            9090) print_status "FAIL" "Port $port - Cockpit exposed (should be disabled)" ;;
        esac
    fi
done

echo ""
echo "========================================="
echo "RESULTS SUMMARY"
echo "========================================="
echo ""
echo "If any tests show [✗] FAIL:"
echo "  - For HTTP tests: The security catch-all server isn't working"
echo "  - Check if nginx-xiric.conf was updated and nginx restarted"
echo "  - Run: podman-compose -f docker-compose-xiric.yml restart nginx"
echo ""
echo "If all tests show [✓] PASS:"
echo "  - The security filters are working correctly"
echo "  - Path traversal, PHP injection, and scanner UAs are blocked"
echo "========================================="
