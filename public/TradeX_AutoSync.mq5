//+------------------------------------------------------------------+
//|                                            TradeX_AutoSync.mq5   |
//|                        Copyright 2024, TradeX Auto-Sync EA       |
//|                                      https://tradex.app          |
//+------------------------------------------------------------------+
#property copyright "TradeX"
#property link      "https://tradex.app"
#property version   "1.00"

//--- Input Parameters
input string WebhookURL = "YOUR_WEBHOOK_URL";           // Webhook URL from TradeX
input string WebhookSecret = "YOUR_WEBHOOK_SECRET";     // Webhook Secret from TradeX
input string AccountNumber = "";                         // Your MT5 Account Number
input string ServerName = "";                            // Your MT5 Server Name
input int SyncIntervalMinutes = 5;                      // Sync interval in minutes

//--- Global Variables
datetime lastSyncTime = 0;
int syncInterval = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("TradeX Auto-Sync EA Initialized");
   Print("Webhook URL: ", WebhookURL);
   Print("Account: ", AccountNumber);
   Print("Server: ", ServerName);

   // Validate inputs
   if(WebhookURL == "YOUR_WEBHOOK_URL" || WebhookURL == "")
   {
      Alert("Please configure Webhook URL in EA settings!");
      return INIT_FAILED;
   }

   if(WebhookSecret == "YOUR_WEBHOOK_SECRET" || WebhookSecret == "")
   {
      Alert("Please configure Webhook Secret in EA settings!");
      return INIT_FAILED;
   }

   if(AccountNumber == "")
   {
      AccountNumber = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
      Print("Auto-detected Account Number: ", AccountNumber);
   }

   if(ServerName == "")
   {
      ServerName = AccountInfoString(ACCOUNT_SERVER);
      Print("Auto-detected Server: ", ServerName);
   }

   syncInterval = SyncIntervalMinutes * 60;

   // Perform initial sync
   SyncTrades();

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("TradeX Auto-Sync EA Stopped");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check if it's time to sync
   if(TimeCurrent() - lastSyncTime >= syncInterval)
   {
      SyncTrades();
   }
}

//+------------------------------------------------------------------+
//| Sync all trades to TradeX                                        |
//+------------------------------------------------------------------+
void SyncTrades()
{
   Print("Starting trade sync...");

   string jsonTrades = "[";
   int tradesAdded = 0;

   // Request historical deals
   datetime fromDate = 0; // Get all history
   datetime toDate = TimeCurrent();

   HistorySelect(fromDate, toDate);

   int totalDeals = HistoryDealsTotal();

   for(int i = 0; i < totalDeals; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);

      if(ticket > 0)
      {
         if(HistoryDealGetInteger(ticket, DEAL_ENTRY) == DEAL_ENTRY_IN ||
            HistoryDealGetInteger(ticket, DEAL_ENTRY) == DEAL_ENTRY_OUT)
         {
            if(tradesAdded > 0) jsonTrades += ",";

            long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
            datetime dealTime = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);

            jsonTrades += "{";
            jsonTrades += "\"ticket\":" + IntegerToString(ticket) + ",";
            jsonTrades += "\"symbol\":\"" + HistoryDealGetString(ticket, DEAL_SYMBOL) + "\",";
            jsonTrades += "\"order_type\":" + IntegerToString(dealType) + ",";
            jsonTrades += "\"lots\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 2) + ",";
            jsonTrades += "\"open_price\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), 5) + ",";
            jsonTrades += "\"open_time\":\"" + TimeToString(dealTime, TIME_DATE|TIME_MINUTES) + "\",";
            jsonTrades += "\"profit\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PROFIT), 2) + ",";
            jsonTrades += "\"commission\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 2) + ",";
            jsonTrades += "\"swap\":" + DoubleToString(HistoryDealGetDouble(ticket, DEAL_SWAP), 2) + ",";
            jsonTrades += "\"comment\":\"" + HistoryDealGetString(ticket, DEAL_COMMENT) + "\"";
            jsonTrades += "}";

            tradesAdded++;
         }
      }
   }

   // Get open positions
   int totalPositions = PositionsTotal();

   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);

      if(ticket > 0)
      {
         if(tradesAdded > 0) jsonTrades += ",";

         long posType = PositionGetInteger(POSITION_TYPE);
         datetime posTime = (datetime)PositionGetInteger(POSITION_TIME);

         jsonTrades += "{";
         jsonTrades += "\"ticket\":" + IntegerToString(ticket) + ",";
         jsonTrades += "\"symbol\":\"" + PositionGetString(POSITION_SYMBOL) + "\",";
         jsonTrades += "\"order_type\":" + IntegerToString(posType) + ",";
         jsonTrades += "\"lots\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         jsonTrades += "\"open_price\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
         jsonTrades += "\"open_time\":\"" + TimeToString(posTime, TIME_DATE|TIME_MINUTES) + "\",";
         jsonTrades += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
         jsonTrades += "\"swap\":" + DoubleToString(PositionGetDouble(POSITION_SWAP), 2) + ",";
         jsonTrades += "\"comment\":\"" + PositionGetString(POSITION_COMMENT) + "\"";
         jsonTrades += "}";

         tradesAdded++;
      }
   }

   jsonTrades += "]";

   // Build payload
   string payload = "{";
   payload += "\"account_number\":\"" + AccountNumber + "\",";
   payload += "\"webhook_secret\":\"" + WebhookSecret + "\",";
   payload += "\"server\":\"" + ServerName + "\",";
   payload += "\"trades\":" + jsonTrades;
   payload += "}";

   // Send to webhook
   bool success = SendWebhook(payload);

   if(success)
   {
      Print("Successfully synced ", tradesAdded, " trades to TradeX");
      lastSyncTime = TimeCurrent();
   }
   else
   {
      Print("Failed to sync trades - will retry next interval");
   }
}

//+------------------------------------------------------------------+
//| Send data to webhook                                             |
//+------------------------------------------------------------------+
bool SendWebhook(string payload)
{
   string headers = "Content-Type: application/json\r\n";

   char post[];
   char result[];
   string resultHeaders;

   ArrayResize(post, StringToCharArray(payload, post, 0, WHOLE_ARRAY, CP_UTF8) - 1);

   int timeout = 5000; // 5 seconds

   int res = WebRequest(
      "POST",
      WebhookURL,
      headers,
      timeout,
      post,
      result,
      resultHeaders
   );

   if(res == 200)
   {
      Print("Webhook sent successfully");
      return true;
   }
   else if(res == -1)
   {
      int error = GetLastError();
      Print("WebRequest error: ", error);
      Print("Note: Make sure the URL is in the 'Allow WebRequest' list in Tools > Options > Expert Advisors");
      return false;
   }
   else
   {
      Print("Webhook failed with code: ", res);
      return false;
   }
}
//+------------------------------------------------------------------+
