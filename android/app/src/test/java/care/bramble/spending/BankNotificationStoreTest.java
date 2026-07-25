package care.bramble.spending;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BankNotificationStoreTest {

    @Test
    public void parsesGoogleWalletAmexNotification() {
        String title = "LONDON NORTH EASTERN RAILWAY";
        String text = "£12.05 with The American Express® Rewards Credit Card ••2002";

        assertEquals(Integer.valueOf(1205), BankNotificationStore.parseAmountCentsForTest(text));
        assertEquals(title, BankNotificationStore.parseMerchantForTest(title, text));
    }

    @Test
    public void matchesGoogleWalletByPackageName() {
        assertTrue(BankNotificationStore.looksLikeBankNotificationForTest(
                "com.google.android.apps.walletnfcrel",
                "Wallet",
                "Wallet The Whiskey Jar £12.90 with Chase Debit Mastercard ••7614"));
    }

    @Test
    public void ignoresDirectChaseAppNotification() {
        assertFalse(BankNotificationStore.looksLikeBankNotificationForTest(
                "com.chase.intl",
                "Chase",
                "Chase You paid £12.90 at The Whiskey Jar with your Chase card"));
    }

    @Test
    public void ignoresDirectAmexAppNotification() {
        assertFalse(BankNotificationStore.looksLikeBankNotificationForTest(
                "com.americanexpress.android.acctsvcs.uk",
                "Amex",
                "American Express You spent £12.05 at LNER"));
    }
}
