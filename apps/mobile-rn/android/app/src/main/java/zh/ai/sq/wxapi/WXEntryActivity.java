package zh.ai.sq.wxapi;

import android.content.Intent;
import android.os.Bundle;
import com.wechatlib.WeChatLibModule;

public class WXEntryActivity extends android.app.Activity {
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WeChatLibModule.handleIntent(getIntent());
    finish();
  }
}
