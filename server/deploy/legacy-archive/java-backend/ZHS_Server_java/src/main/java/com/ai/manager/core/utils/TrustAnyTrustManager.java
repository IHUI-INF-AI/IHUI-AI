package com.ai.manager.core.utils;

import javax.net.ssl.X509TrustManager;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
public class TrustAnyTrustManager implements X509TrustManager {
    public void checkClientTrusted(X509Certificate[] arg0, String arg1)
            throws CertificateException {
        // TODO Auto-generated method stub
    }
    public void checkServerTrusted(X509Certificate[] arg0, String arg1)
            throws CertificateException {
        // TODO Auto-generated method stub
    }
    public X509Certificate[] getAcceptedIssuers() {
        return new X509Certificate[] {};
    }
}
