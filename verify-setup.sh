#!/bin/bash

echo "🔍 TradeX Setup Verification"
echo "=============================="
echo ""

# Check .env file
if [ -f .env ]; then
    echo "✅ .env file exists"

    if grep -q "VITE_SUPABASE_URL=https://irtlwmpcfzjrlrxicxbk.supabase.co" .env; then
        echo "✅ Supabase URL configured correctly"
    else
        echo "❌ Supabase URL not configured"
    fi

    if grep -q "VITE_SUPABASE_ANON_KEY=" .env; then
        echo "✅ Supabase Anon Key configured"
    else
        echo "❌ Supabase Anon Key missing"
    fi
else
    echo "❌ .env file not found"
fi

echo ""

# Check if supabase functions directory exists
if [ -d "supabase/functions" ]; then
    FUNCTION_COUNT=$(find supabase/functions -maxdepth 1 -type d | tail -n +2 | wc -l)
    echo "✅ Edge Functions directory exists"
    echo "   Found $FUNCTION_COUNT function folders"
else
    echo "❌ Edge Functions directory not found"
fi

echo ""

# Check if migrations exist
if [ -d "supabase/migrations" ]; then
    MIGRATION_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)
    echo "✅ Database migrations exist"
    echo "   Found $MIGRATION_COUNT migration files"
else
    echo "❌ Migrations directory not found"
fi

echo ""
echo "Next Steps:"
echo "==========="
echo "1. Add API secrets to Supabase Vault"
echo "   👉 https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/settings/vault"
echo ""
echo "2. Deploy Edge Functions"
echo "   👉 https://supabase.com/dashboard/project/irtlwmpcfzjrlrxicxbk/functions"
echo ""
echo "3. Check COMPLETE_SETUP_GUIDE.md for detailed instructions"
echo ""
