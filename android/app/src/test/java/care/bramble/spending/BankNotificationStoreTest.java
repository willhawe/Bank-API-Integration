package care.bramble.spending;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class BankNotificationStoreTest {

    @Test
    public void parsesGoogleWalletAmexNotification() {
        String title = "LONDON NORTH EASTERN RAILWAY";
        String text = "£12.05 with The American Express® Rewards Credit Card ••2002";

        assertEquals(Integer.valueOf(1205), BankNotificationStore.parseAmountCentsForTest(text));
        assertEquals(title, BankNotificationStore.parseMerchantForTest(title, text));
    }
}
