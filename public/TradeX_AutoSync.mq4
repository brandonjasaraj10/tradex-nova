//+------------------------------------------------------------------+
//|                                            TradeX_AutoSync.mq4   |
//|                        Copyright 2024, TradeX Auto-Sync EA       |
//|                                      https://tradex.app          |
//+------------------------------------------------------------------+
#property copyright "TradeX"
#property link      "https://tradex.app"
#property version   "1.00"
#property strict

//--- Input Parameters
input string WebhookURL = "YOUR_WEBHOOK_URL";           // Webhook URL from TradeX
input string WebhookSecret = "YOUR_WEBHOOK_SECRET";     // Webhook Secret from TradeX
input string AccountNumber = "";                         // Your MT4 Account Number
input string ServerName = "";                            // Your MT4 Server Name
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

   int totalOrders = OrdersHistoryTotal();
   string jsonTrades = "[";
   int tradesAdded = 0;

   // Get closed trades from history
   for(int i = 0; i < totalOrders; i++)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_HISTORY))
      {
         if(OrderType() <= 1) // Only Buy and Sell orders
         {
            if(tradesAdded > 0) jsonTrades += ",";

            jsonTrades += "{";
            jsonTrades += "\"ticket\":" + IntegerToString(OrderTicket()) + ",";
            jsonTrades += "\"symbol\":\"" + OrderSymbol() + "\",";
            jsonTrades += "\"order_type\":" + IntegerToString(OrderType()) + ",";
            jsonTrades += "\"lots\":" + DoubleToString(OrderLots(), 2) + ",";
            jsonTrades += "\"open_price\":" + DoubleToString(OrderOpenPrice(), 5) + ",";
            jsonTrades += "\"open_time\":\"" + TimeToString(OrderOpenTime(), TIME_DATE|TIME_MINUTES) + "\",";
            jsonTrades += "\"close_price\":" + DoubleToString(OrderClosePrice(), 5) + ",";
            jsonTrades += "\"close_time\":\"" + TimeToString(OrderCloseTime(), TIME_DATE|TIME_MINUTES) + "\",";
            jsonTrades += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
            jsonTrades += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
            jsonTrades += "\"swap\":" + DoubleToString(OrderSwap(), 2) + ",";
            jsonTrades += "\"comment\":\"" + OrderComment() + "\"";
            jsonTrades += "}";

            tradesAdded++;
         }
      }
   }

   // Get open trades
   int totalOpen = OrdersTotal();
   for(int i = 0; i < totalOpen; i++)
   {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
      {
         if(OrderType() <= 1) // Only Buy and Sell orders
         {
            if(tradesAdded > 0) jsonTrades += ",";

            jsonTrades += "{";
            jsonTrades += "\"ticket\":" + IntegerToString(OrderTicket()) + ",";
            jsonTrades += "\"symbol\":\"" + OrderSymbol() + "\",";
            jsonTrades += "\"order_type\":" + IntegerToString(OrderType()) + ",";
            jsonTrades += "\"lots\":" + DoubleToString(OrderLots(), 2) + ",";
            jsonTrades += "\"open_price\":" + DoubleToString(OrderOpenPrice(), 5) + ",";
            jsonTrades += "\"open_time\":\"" + TimeToString(OrderOpenTime(), TIME_DATE|TIME_MINUTES) + "\",";
            jsonTrades += "\"profit\":" + DoubleToString(OrderProfit(), 2) + ",";
            jsonTrades += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
            jsonTrades += "\"swap\":" + DoubleToString(OrderSwap(), 2) + ",";
            jsonTrades += "\"comment\":\"" + OrderComment() + "\"";
            jsonTrades += "}";

            tradesAdded++;
         }
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

   ArrayResize(post, StringToCharArray(payload, post, 0, WHOLE_ARRAY) - 1);

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
