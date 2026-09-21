const securityText = `Contact: https://github.com/AgoraNetLegacy/agoranetv3-platform/security/advisories/new
Policy: https://github.com/AgoraNetLegacy/agoranetv3-platform/security/policy
Preferred-Languages: en
Expires: 2027-08-15T00:00:00.000Z
`;

export function GET() {
  return new Response(securityText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
