---
name: mobile-security
description: Implement mobile application security for iOS and Android. Outputs secure storage, certificate pinning, code obfuscation, biometric auth, and API security patterns.
argument-hint: [platform, data sensitivity, authentication method, compliance requirements]
allowed-tools: Read, Write
---

# Mobile Security

Mobile apps face unique threats: rooted/jailbroken devices, reverse engineering, insecure local storage, and network interception. Defence requires secure storage, certificate pinning, code hardening, and proper authentication — not just HTTPS.

## Secure Storage

```swift
// iOS — Keychain for secrets
import Security

class KeychainStorage {
    func save(key: String, data: Data) -> Bool {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrAccount as String:      key,
            kSecValueData as String:        data,
            kSecAttrAccessible as String:   kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemDelete(query as CFDictionary)  // Delete existing
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }
    
    func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String:  true,
            kSecMatchLimit as String:  kSecMatchLimitOne,
        ]
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        return result as? Data
    }
}

// NEVER use UserDefaults for sensitive data
// UserDefaults.standard.set(authToken, forKey: "token") — BAD
```

```kotlin
// Android — EncryptedSharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

val masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)

val securePrefs = EncryptedSharedPreferences.create(
    "secure_prefs",
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Save token securely
securePrefs.edit().putString("auth_token", token).apply()

// Android Keystore for cryptographic keys
val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
keyGenerator.init(
    KeyGenParameterSpec.Builder("my_key_alias",
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setUserAuthenticationRequired(true)   // Require biometric
        .build()
)
```

## Certificate Pinning

```swift
// iOS — URLSession with certificate pinning
import Foundation
import CryptoKit

class PinnedURLSession: NSObject, URLSessionDelegate {
    // SHA-256 hash of the server's public key
    let pinnedPublicKeyHash = "base64encodedSHA256HashHere=="
    
    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust,
              let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0),
              let publicKey = SecCertificateCopyKey(certificate),
              let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        let serverHash = SHA256.hash(data: publicKeyData).base64EncodedString()
        
        if serverHash == pinnedPublicKeyHash {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
```

## Biometric Authentication

```swift
// iOS — Face ID / Touch ID
import LocalAuthentication

func authenticateWithBiometrics() async -> Bool {
    let context = LAContext()
    var error: NSError?
    
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        return false
    }
    
    do {
        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Authenticate to access your account"
        )
    } catch {
        return false
    }
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Tokens in SharedPreferences/UserDefaults** | Readable on rooted device | EncryptedSharedPreferences / Keychain |
| **No certificate pinning** | MITM attacks via rogue CA | Pin public key hash; handle pin rotation |
| **Hardcoded API keys in binary** | Extractable via reverse engineering | Server-side key management; device attestation |
| **Logging sensitive data** | Crashes logs sent to third-party analytics | Strip PII/tokens from all log statements |
| **No jailbreak/root detection** | Compromised device bypasses security controls | Detect and warn/block on compromised devices |

## 10 Rules

1. Keychain (iOS) / EncryptedSharedPreferences + Keystore (Android) for all secrets.
2. Never log authentication tokens, PII, or financial data.
3. Certificate pinning for all production API connections — with a rotation plan.
4. Biometric authentication for high-value actions — not just app unlock.
5. Reverse engineering hardening: minification, obfuscation, anti-tamper checks.
6. Detect rooted/jailbroken devices and degrade security-sensitive features.
7. OWASP Mobile Top 10 guides the security test checklist.
8. Static analysis (MobSF, semgrep) in CI catches common mobile security issues.
9. Dynamic analysis (Frida, Objection) as part of penetration testing.
10. Secure communication: TLS 1.2+, certificate pinning, no plaintext fallback.
