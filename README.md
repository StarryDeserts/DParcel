# D-parcel: Secure, Decentralized File Sharing on Sui

## What is D-parcel?

D-parcel is a revolutionary "decentralized file locker" built on the Sui blockchain, leveraging Walrus for decentralized storage and Seal for advanced access control. It redefines file sharing by giving users unprecedented control, security, and privacy over their digital assets.

**Imagine a world where you can securely share files with anyone, for a specific duration, using a simple "pickup code," all without relying on a central authority!**

## Core Architecture & How It Works

D-parcel's magic lies in the synergy of three powerful Web3 technologies:

1. **Sui Blockchain:** Provides a high-performance, scalable, and secure Layer 1 foundation. All critical metadata, access policies, and file lifecycle rules are managed as programmable objects on Sui, ensuring transparency and tamper-proof execution.
2. **Walrus Decentralized Storage:** User files are encrypted client-side and then stored as "blobs" on Walrus. This offers resilient, censorship-resistant storage. Crucially, **senders can specify the exact "existence time" for their files on Walrus**, enabling true temporary storage.
3. **Seal Access Control Protocol:** This is where the "pickup code" comes to life. Seal manages the cryptographic secrets and enforces on-chain access policies. When a file is uploaded, a unique pickup code is generated. This code isn't just a password; it's a token that unlocks access based on rules defined on the Sui blockchain (e.g., expiry time). Seal's threshold encryption ensures that even if some key servers are compromised, your data remains secure.

**The Flow:**

1. **Connect Wallet:** Users connect their Sui-compatible wallet.
2. **Upload & Set Duration:** Users upload a file and specify how long it should exist on Walrus.
3. **Get Pickup Code:** A unique, secure pickup code is generated via Seal.
4. **Share Code:** The sender shares this code with the intended recipient.
5. **Recipient Retrieves:** The recipient uses the pickup code on D-parcel to download the file directly from Walrus after Seal verifies the code against on-chain policies.

## What Makes D-parcel Exciting & Unique?

D-parcel isn't just another file-sharing service. Its decentralized architecture unlocks capabilities that are simply not feasible with traditional, centralized solutions:

- **True User Sovereignty:**
  - **You control the lifespan:** Define precisely how long your file exists. No more relying on a platform's arbitrary deletion policies. This is perfect for "digital dead drops" or time-sensitive information.
  - **You control access:** The pickup code, governed by on-chain Seal policies, means only those you authorize can access the file, and only under the conditions you set.
- **Unparalleled Security & Privacy:**
  - **Client-Side Encryption:** Files are encrypted *before* they leave your device.
  - **Decentralized Trust:** No single entity holds all the keys or all the data. Walrus distributes storage, and Seal decentralizes key management.
  - **On-Chain Verifiable Policies:** Access rules are transparent and enforced by the Sui blockchain, not hidden server-side logic.
- **Censorship Resistance:** Files stored on Walrus are significantly harder to take down or censor compared to centralized alternatives.
- **Programmable Access:**
  - **Time-locked access via pickup codes:** Grant access for specific windows, enforced by Seal and Sui.
  - **Future possibilities:** Imagine pickup codes that only work if the recipient holds a specific NFT, or codes that expire after a single use, all defined and enforced on-chain!
- **Cost-Effective Large File Storage:** Walrus is designed for efficient storage of large binary files, making D-parcel economically viable for various use cases.

**D-parcel empowers users with a file-sharing experience that is genuinely secure, private, and self-determined, showcasing the true potential of composable Web3 technologies!**

## Get Involved!

[D-parcel](https://d-parcel.vercel.app/)
