#!/bin/bash
# Auto-generated Atlas Import Script
# PREREQUISITES: 'curl' and 'jq' must be installed.

# --- Configuration ---
ATLAS_URL="https://se-aws-edl-gateway.se-sandb.a465-9q4k.cloudera.site/se-aws-edl/cdp-proxy-api/atlas/api/atlas"

# Stop on error
set -e

echo "---------------------------------------------"
echo "Starting Import to $ATLAS_URL"
echo "---------------------------------------------"

# --- 1. Create Glossary ---
echo "Creating Glossary: Banking Domain..."
read -r -d '' GLOSSARY_PAYLOAD << 'EOF'
{
  "qualifiedName": "Banking Domain.1768327459543",
  "name": "Banking Domain",
  "shortDescription": "Standard glossary for banking terms.",
  "longDescription": "Standard glossary for banking terms.",
  "language": "en",
  "usage": "N/A"
}
EOF

GLOSSARY_RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$GLOSSARY_PAYLOAD" "$ATLAS_URL/v2/glossary")
GLOSSARY_GUID=$(echo "$GLOSSARY_RES" | jq -r .guid)
if [ "$GLOSSARY_GUID" == "null" ]; then echo "Failed to create glossary. Response: $GLOSSARY_RES"; exit 1; fi
echo "  > Created Glossary GUID: $GLOSSARY_GUID"

# --- 2. Create Categories ---
echo "Creating Category: Accounts..."
# Construct payload for Accounts
PAYLOAD_c1=$(jq -n \
  --arg name "Accounts" \
  --arg desc "All types of bank accounts" \
  --arg anchor "$GLOSSARY_GUID" \
  '{name: $name, shortDescription: $desc, longDescription: $desc, anchor: {glossaryGuid: $anchor}}')
RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$PAYLOAD_c1" "$ATLAS_URL/v2/glossary/category")
CAT_c1_GUID=$(echo "$RES" | jq -r .guid)
echo "  > Created Category Accounts ($CAT_c1_GUID)"

echo "Creating Category: Savings..."
# Construct payload for Savings
PAYLOAD_c2=$(jq -n \
  --arg name "Savings" \
  --arg desc "Savings specific accounts" \
  --arg anchor "$GLOSSARY_GUID" \
  --arg parent "$CAT_c1_GUID" \
  '{name: $name, shortDescription: $desc, longDescription: $desc, anchor: {glossaryGuid: $anchor}, parentCategory: {categoryGuid: $parent}}')
RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$PAYLOAD_c2" "$ATLAS_URL/v2/glossary/category")
CAT_c2_GUID=$(echo "$RES" | jq -r .guid)
echo "  > Created Category Savings ($CAT_c2_GUID)"

# --- 3. Create Terms (Phase 1) ---
echo "Creating Term: Account..."
PAYLOAD=$(jq -n \
  --arg name "Account" \
  --arg desc "A financial arrangement." \
  --arg anchor "$GLOSSARY_GUID" \
  --arg cat "$CAT_c1_GUID" \
  '{name: $name, shortDescription: $desc, longDescription: $desc, anchor: {glossaryGuid: $anchor}, categories: [{categoryGuid: $cat}]}')
RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$PAYLOAD" "$ATLAS_URL/v2/glossary/term")
TERM_t1_GUID=$(echo "$RES" | jq -r .guid)
echo "  > Created Term Account ($TERM_t1_GUID)"

echo "Creating Term: Savings Account..."
PAYLOAD=$(jq -n \
  --arg name "Savings Account" \
  --arg desc "Interest bearing account." \
  --arg anchor "$GLOSSARY_GUID" \
  --arg cat "$CAT_c2_GUID" \
  --arg parent "$TERM_t1_GUID" \
  '{name: $name, shortDescription: $desc, longDescription: $desc, anchor: {glossaryGuid: $anchor}, categories: [{categoryGuid: $cat}], isA: [{termGuid: $parent}]}')
RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$PAYLOAD" "$ATLAS_URL/v2/glossary/term")
TERM_t2_GUID=$(echo "$RES" | jq -r .guid)
echo "  > Created Term Savings Account ($TERM_t2_GUID)"

echo "Creating Term: Checking Account..."
PAYLOAD=$(jq -n \
  --arg name "Checking Account" \
  --arg desc "Transactional account." \
  --arg anchor "$GLOSSARY_GUID" \
  --arg cat "$CAT_c1_GUID" \
  --arg parent "$TERM_t1_GUID" \
  '{name: $name, shortDescription: $desc, longDescription: $desc, anchor: {glossaryGuid: $anchor}, categories: [{categoryGuid: $cat}], isA: [{termGuid: $parent}]}')
RES=$(curl -s -S -X POST -u "esteinholtz:Gurka222" -H "Content-Type: application/json" -d "$PAYLOAD" "$ATLAS_URL/v2/glossary/term")
TERM_t3_GUID=$(echo "$RES" | jq -r .guid)
echo "  > Created Term Checking Account ($TERM_t3_GUID)"

echo "---------------------------------------------"
echo "Import Complete!"
