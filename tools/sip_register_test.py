#!/usr/bin/env python3
"""Sends a real SIP REGISTER (with digest auth) to the pbx and prints the answers.

usage: python3 tools/sip_register_test.py <pbx-ip> <extension> <password> [port]
"""
import hashlib
import random
import re
import socket
import sys

if len(sys.argv) < 4:
    sys.exit(__doc__)

host, user, password = sys.argv[1], sys.argv[2], sys.argv[3]
port = int(sys.argv[4]) if len(sys.argv) > 4 else 5060

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(("0.0.0.0", 0))
sock.settimeout(4)
local_port = sock.getsockname()[1]

call_id = "%032x" % random.getrandbits(128)
uri = f"sip:{host}"


def build_register(cseq, authorization=None):
    lines = [
        f"REGISTER {uri} SIP/2.0",
        f"Via: SIP/2.0/UDP {host}:{local_port};branch=z9hG4bK{random.getrandbits(32):x};rport",
        "Max-Forwards: 70",
        f"From: <sip:{user}@{host}>;tag=t{random.getrandbits(24):x}",
        f"To: <sip:{user}@{host}>",
        f"Call-ID: {call_id}",
        f"CSeq: {cseq} REGISTER",
        f"Contact: <sip:{user}@{host}:{local_port}>",
        "Expires: 60",
        "User-Agent: pbx-register-test",
    ]
    if authorization:
        lines.append("Authorization: " + authorization)
    lines += ["Content-Length: 0", "", ""]
    return "\r\n".join(lines).encode()


def send_and_wait(cseq, authorization=None):
    sock.sendto(build_register(cseq, authorization), (host, port))
    while True:
        data, _ = sock.recvfrom(4096)
        text = data.decode(errors="replace")
        # asterisk may send an OPTIONS probe in between, only a response matters
        if text.startswith("SIP/2.0") and f"CSeq: {cseq} REGISTER" in text:
            return text


try:
    first = send_and_wait(1)
except socket.timeout:
    sys.exit(f"no answer from {host}:{port}/udp, the packet never came back")

print("1st answer:", first.split("\r\n")[0])
challenge = re.search(r"WWW-Authenticate: Digest (.*)", first)
if not challenge:
    sys.exit("no digest challenge in the answer, nothing more to test")

fields = dict(re.findall(r'(\w+)="?([^",]+)"?', challenge.group(1)))
ha1 = hashlib.md5(f"{user}:{fields['realm']}:{password}".encode()).hexdigest()
ha2 = hashlib.md5(f"REGISTER:{uri}".encode()).hexdigest()
digest = hashlib.md5(f"{ha1}:{fields['nonce']}:{ha2}".encode()).hexdigest()
authorization = (
    f'Digest username="{user}", realm="{fields["realm"]}", nonce="{fields["nonce"]}", '
    f'uri="{uri}", response="{digest}", algorithm=MD5'
)

try:
    second = send_and_wait(2, authorization)
except socket.timeout:
    sys.exit("no answer to the authenticated REGISTER")

status = second.split("\r\n")[0]
print("2nd answer:", status)
if " 200 " in status:
    print("registered ok")
elif " 401 " in status or " 403 " in status:
    print("rejected: wrong extension or password")