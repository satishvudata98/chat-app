import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const kp = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    privateKey: encodeBase64(kp.secretKey),
  };
}

export function encryptMessage(
  text: string,
  theirPublicKeyB64: string,
  myPrivateKeyB64: string,
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(
    encodeUTF8(text),
    nonce,
    decodeBase64(theirPublicKeyB64),
    decodeBase64(myPrivateKeyB64),
  );
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);
  return encodeBase64(combined);
}

// theirPublicKeyB64 is always the OTHER party in the 2-person chat,
// regardless of who sent the message (X25519 shared secret is symmetric).
export function decryptMessage(
  ciphertextB64: string,
  theirPublicKeyB64: string,
  myPrivateKeyB64: string,
): string | null {
  try {
    const combined = decodeBase64(ciphertextB64);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      decodeBase64(theirPublicKeyB64),
      decodeBase64(myPrivateKeyB64),
    );
    return decrypted ? decodeUTF8(decrypted) : null;
  } catch {
    return null;
  }
}
