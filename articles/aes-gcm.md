- Course: MAT4007 Introduction to Cryptography
- Author: Linzheng Tan

This report serves as the supplement of the presentation and the code demos. We will discuss the pros and cons of AES-GCM in details. For the pros, we compare it with the previous AES-CBC + HMAC mode (used in the protocol TLS 1.0/1.1) to see its advantage in security and parallelism. For the cons, we use three toy attack demos and the classic forbidden attack example to show the fatal flaw of AES-GCM: the reused or collision of the IV.

Code demos (reference implementation + attacks): https://github.com/Robbo4729/AES_GCM

# Pros 
The following two schematic diagrams show the encryption process of AES-GCM and the AES-CBC separately. [^1][^2]
![AES-CBC schematic](../assets/CBC.png)

![AES-GCM schematic](../assets/aes_gcm.png)

[^1]: https://derekwill.com/2021/01/01/aes-cbc-mode-chosen-plaintext-attack/
[^2]: A. Reyhani-Masoleh and M. Mozaffari-Kermani, "Efficient and High-Performance Parallel Hardware Architectures for the AES-GCM" in IEEE Transactions on Computers, vol. 61, no. 08, pp. 1165-1178, Aug. 2012, doi: 10.1109/TC.2011.125.
    
### Parallelism 
AES-GCM uses CTR mode to encrypt/decrypt the message and the GHASH to authenticate the message. The AES-CBC + HMAC uses CBC mode to encrypt/decrypt the message. So AES-GCM can encrypt/decrypt each block simultaneously while the encrypt/decrypt of one block of AES-CBC must depend on the result of previous block. 
$$
\begin{align}
 & \text{use }p=(p_{1},\cdots ,p_{n}),c=(c_{1},\cdots ,c_{n})\text{ to represent plaintext and ciphertext respectively} \\
 & e_{k}\text{ represents the AES block cipher} \\
 & \text{(AES-CBC encryption) }c_{i}=e_{k}(c_{i-1}\oplus p_{i}),c_{0}=IV,1\leq i\leq n\\
 & \text{(AES-CTR encryption) } \text{ (nonce) }IV\in \left\{ 0,1 \right\} ^{96}\\
 & \qquad j_{0}= IV \parallel 0^{31}\parallel 1\\
 & \qquad j_{i} = j_{i-1}+1 , 1\leq i\leq n\\
 & \qquad c_{i}=p_{i}\oplus e_{k}(j_{i}),1\leq i\leq n \\
\end{align}
$$
Besides the algorithm design, the implementation of AES-GCM is very fast on Intel and AMD processors because of special AES-NI and PCLMUL instructions for the AES and $\cdot$ operations

### Security
AES-CBC + HMAC used in TLS 1.0 is MtE (Mac then Encrypt). As we learnt in class, the hacker can use the **padding oracle attack** to get whole plaintext and the MAC. Using AES-CBC + HMAC with EtM, though theoretically is hard to break, but it increases the complexity of key management (one key for encrypt, one key for authentication) and the time to encrypt/decrypt the message.

# Cons
Also AES-GCM is a very efficient algorithm, the reuse of nonce IV is a catastrophe. The attack of $H=E_{k}(0^{128})$ is equivalent to solve a polynomial root-finding problem in $GF(2^{128})$. The attacker can use **Berlekamp's algorithm** to efficiently solve it. 
$$
f(H)= \sum_{i=0}^{n} \alpha_{i}H^{i}=0, H\in GF(2^{128})
$$
To send message, we take Additional Authenticated Data (AAD) $A=(A_1,A_{2},\cdots,A_{m})$, message $M=(M_{1},M_{2},\cdots,M_{n})$, the initialization vector $IV\in \left\{ 0,1 \right\} ^{96}$ and the secret key $k\in \left\{ 0,1 \right\}^{128}$ as input, output the $(IV,A,C,T)$, where $C\in \left\{ 0,1 \right\}^{n}$ and $T$ is the authentication tag.
The whole process can be described as follows: ($E_{k}$ is the AES block cipher)
$$
\begin{align}
 & 1. L=L_{A}\parallel L_{M},L_{A}\text{ is the lengh of }A, L_{A},L_{M}\in \left\{ 0,1 \right\} ^{64} \\
 & 2.\text{Encrypt: }J_{0}=IV\parallel 0^{31}\parallel 1 ,J_{i}=J_{i-1}+1,C_{i}=E_{k}(J_{i})\oplus M_{i} (1\leq i\leq n)\\
 & 4.\text{Authenticate: }H=E_{k}(0^{128}), T=E_{k}(J_{0})\oplus f_{A,C}(H) \\
 & 5.\text{Output: }(IV,A,C,T)
\end{align}
$$
here, $f_{A,C}(x)=A_{1}x^{m+n+1}+A_{2}x^{m+n}+\cdots+A_{m}x^{n+2}+C_{1}x^{n+1}+\cdots C_{n}x^{2}+Lx$. In hardware implementation, we use **Horner's rule** to calculate $f_{A,C}(H)$ to simplify the process into $m+n$ addition and $m+n+1$ multiplication. For example:
$$
f_{A,C}(H)=A_{1}\cdot H^{4}+A_{2}\cdot H^{3}+C_{1}\cdot H^{2}+LH=(((A_{1}\cdot H+A_{2})\cdot H+A_{3})\cdot H+L)\cdot H
$$ 
For the same key $k$, if we used $IV$ twice, $J_{i}(0\leq i\leq n)$ should be same. In $GF(2^{128})$, $+$ is exactly the $\oplus$ operation and $-$ operation.
$$
\begin{align}
 & T_{1}=E_{k}(J_{0})+f_{1}(H),T_{2}=E_{k}(J_{0})+f_{2}(H) \\
 & T_{1}+T_{2}=f_{1}(H)+f_{2}(H) \\
 & f(H)=f_{1}(H)+f_{2}(H)+T_{1}+T_{2}=\sum_{i=0}^{n} \alpha _{i}H^{i}=0  \\
\end{align}
$$
The attacker can get $n$ different roots. To uniquely determine such $H$, the attacker can capture other packets with the same IV, using different $H$ to verify $T$ directly. Or the attacker can build another $f'(H)$, get another $n$ different roots to find the same $H$ or even using the **oracle test**, brute-force enumerate all possible $H$, build message and send to server to see if the test passed.

Once the attacker get the $H$, he can get $E_{k}(J_{0})$ by $E_{k}(J_{0})=T\oplus f_{A,C}(H)$. Then he is able to transmit junk data to the recipient that bypasses validation checks: $(IV,A,C_{\text{meaningless}},T')$, where $T'=E_{k}(J_{0})\oplus f_{A,C_{\text{meaningless}}}(H)$. 

If the attacker has a known $(M,C)$ pair with the length equal or larger to $(M_{\text{fake}},C_{\text{fake}})$, he can forge any information as long as the key and IV are not changed: 
$$
\begin{align}
 & C_{\text{(fake)}i }\oplus C_{i}=E_{k}(J_{i})\oplus M_{\text{(fake)}i}\oplus E_{k}(J_{i})\oplus M_{i} =M_{(\text{fake})i}\oplus M_{i} \\
 & \text{then }C_{\text{fake}}=M_{\text{fake}}\oplus M\oplus C \\
 & T_{\text{fake}}=E_{k}(J_{0})\oplus f_{A_{\text{fake}},C_{\text{fake}}}(H) \\
 & \text{send }(IV,A_{\text{fake}},C_\text{fake},T_{\text{fake}})\rightarrow \text{pass verification}
\end{align}
$$
Instead of using **Berlekamp's algorithm** in general cases, 3 demos in code packages show three simpler situations. 

### IV Reused + Known Plain Text
The attacker can use the known plaintext and ciphertext pair to decrypt part of or the whole information, since the **keystreams** $E_{k}(J_{i})(1\leq i\leq n)$ generated by the same key and IV are the same. 
$$
\begin{align}
 & (IV,A_{1},C_{\text{known}},T_{1} ),(IV,A_{2},C_{2},T_{2}) \\
 & \text{then }M_{2i}=M_{\text{known}i}\oplus C_{\text{known}i}\oplus C_{2i},1\leq i\leq \min\left\{ L_{C_{\text{known}}}, L_{C_{2}}\right\} 
\end{align}
$$
In real world, the $(M_{\text{known}},C_{\text{known}})$ is available for fixed protocol headers or static resources (file format). Besides, the attacker can use the Man-in-the-Middle (MITM) attack to get a plaintext-ciphertext pair. 

Use `python iv_reused_attack_a.py` to run the demo, the output should look like 

```bash
--- STEP 1: Attacker intercepts two messages with the same IV ---
[*] Intercepted Msg 1 (Known):   'Balance Query...'
[*] Intercepted Ciphertext 1:    d9d34086b79017e1bf5e4d00520bdc28
[*] Intercepted Ciphertext 2:    cbd355c79d9204a88a0b0c431b15c236

--- STEP 2: Extracting Keystream ---
[*] Recovered Keystream:         9bb22ce7d9f372c1ee2b28722b25f206

--- STEP 3: Decrypting Target Message ---
[*] Decrypted Plaintext:         'Pay David $10000'

--- STEP 4: Verification ---
[SUCCESS] Secret message recovered successfully!

[NOTE] AAD was present but ignored. It only affects the Tag, not the Keystream.
```

### IV Reused + No AAD + One Block Message
This demo shows the iv reused attack without AAD and only one block message. Also I use Alice and bank in demo, this is super unlikely to happen in reality. For some custom IoT communicaiton, the developer might ignore the importance of AAD and use the counter to generate IV, which returns to 0 whenever rebooting. Here is the process to get $H$ in this case.
$$
\begin{align}
 & \text{capture } (IV,C_{1},T_{1}),(IV,C_{2},T_{2}) \\
 & T_{1}=C_{1}H^{2}+LH+E_{k}(J_{0}) \\
 & T_{2}=C_{2}H^{2}+LH+E_{k}(J_{0}) \\
 & \implies T_{1}+T_{2}=(C_{1}+C_{2})\cdot H^{2} \\
 & \implies H=\left( \frac{T_{1}+T_{2}}{C_{1}+C_{2}} \right) ^{1/2} \\
 & \text{By Fermat's Little Theorem: }a^{q-1}=1,\forall \text{ nonezero }a\in GF(q)  \\
 & \implies a^{-1}=a^{q-2}=a^{2^{128}-2} \in GF(2^{128})\\
  & \forall a\in GF(2^{n}), \left( a^{2^{n-1}} \right) ^{2}=a^{2^{n}}=a\implies a^{1/2}=a^{2^{127}}\in GF(2^{128}) \\
 & \text{Then }H=\left( (T_{1}+T_{2})\cdot (C_{1}+C_{2})^{2^{128}-2} \right)^{127} 
\end{align}
$$
Use `python iv_reused_attack_b.py` to run this demo, the output should look like

```bash
--- STEP 1: Attacker intercepts two messages with the same IV ---
[*] Intercepted Msg 1: 'Pay David $1000 ' | Tag: 087739a9e9a886d93f7667e6decb78d9
[*] Intercepted Msg 2: 'Pay Bob   $2000 ' | Tag: 74c5764b358f978ed48604cd808c6505

--- STEP 2: Mathematical Recovery (Cracking H and E(J0)) ---
[!] Solving equation: T1 ^ T2 = (C1 ^ C2) * H^2
[*] Calculating Multiplicative Inverse of Delta_C...
[*] Extracting Square Root in GF(2^128)...
[!] Recovered H: b83b533708bf535d0aa6e52980d53b78
    (Actual H:   b83b533708bf535d0aa6e52980d53b78)
[!] Recovered Ek(J0): 3247184b3c4f69a44dbcd22887bbb418

--- STEP 3: Malicious Tampering & Forgery ---
[*] Target Forged Message: 'Pay Eve $9999999'
[*] Forged Ciphertext: cbd355c79c8517e1ca12114b121ccb3f
[*] Forged Tag:        e8f2b0a1315ec0fa4ce8938d779b5213

--- STEP 4: Bank Verification ---
[SUCCESS] Bank System: MAC verification PASSED! Signature is valid.
[SUCCESS] Bank executing instruction: 'Pay Eve $9999999'
```

### IV Reused + Same AAD + Smaller/Equal to One Block Message
This demo shows the iv reused attack with same AAD, different message length and no larger than one-block message. Still, for some custom IoT communication, the developer might treat AAD as the tag and use AAD like `DeviceID:SN-9951` to identify the device. Here is the process to get all possible $H$ in this case.
$$
\begin{align}
 & \text{capture } (IV,A,C_{1},T_{1}),(IV,A,C_{2},T_{2}) \\
 & T_{1}=A\cdot H^{3}+C_{1}\cdot H^{2}+L_{1}\cdot H+E_{k}(J_{0}) \\
 & T_{2}=A\cdot H^{3}+C_{2}\cdot H^{2} +L_{2}\cdot H+E_{k}(J_{0}) \\
 & T_{1}+T_{2}=(C_{1}+C_{2})\cdot H^{2}+(L_{1}+L_{2})\cdot H \\
 & \implies H^{2}+\frac{L_{1}+L_{2}}{C_{1}+C_{2}}H=\frac{T_{1}+T_{2}}{C_{1}+C_{2}},H^{2}+BH=C\\
 & \implies H=Bz,z^{2}+z=K=\frac{C}{B^{2}}
\end{align}
$$
Now we only need to find all such $z$ satisfying $z^{2}+z=K$. Now we treat $GF(2^{128})$ as a vector space $V$ over the field $\mathbb{F}_{2}$. Given the basis $\mathcal{B}=\left\{ 1,\alpha,\cdots,\alpha ^{127} \right\}$, all elements $x\in V$ can be written as $z=\sum_{i=1}^{127}z_{i}\alpha ^{i},z_{i}\in \left\{ 0,1 \right\}$. Since $(a+b)^{2}=a^{2}+2ab+b^{2}=a^{2}+b^{2}$ in $GF(2^{128})$, we have $z^{2}=\sum_{i=0}^{127}z_{i}^{2}\alpha ^{2i}=\sum_{i=0}^{127}z_{i}\alpha ^{2i}$, where $\left\{ \alpha ^{2i},0\leq i\leq 127 \right\}$ is just a permutation of the basis. Define $\phi:V\rightarrow V$ by $\phi(z)=z^{2}+z$.  
$$
\begin{align}
 & \phi(cz)=cz^{2}+cz=c(z^{2}+z)=c\phi(z) \\
 & \phi(z_{1}+z_{2})=(z_{1}+z_{2})^{2}+z_{1}+z_{2}=z_{1}^{2}+z_{1}+z_{2}^{2}+z_{2}=\phi(z_{1})+\phi(z_{2})
\end{align}
$$
Then $\phi$ is a linear transformation and can be represented as a matrix $M$.
$$
\phi(z)=\phi\left( \sum_{i=0}^{127} z_{i}\alpha ^{i} \right)=\sum_{i=0}^{127} z_{i}\phi(\alpha ^{i})\implies M_{j}=[\phi(\alpha ^{j})]_{\mathcal{B}}^{T}\,(\text{ j-th column of }M)
$$
For example, 
$$
\begin{align}
 & [\alpha]_{\mathcal{B}}=[0,1,0,\cdots,0]^{T} \text{ and }[\phi(\alpha)]_{\mathcal{B}}=[\alpha ^{2}+\alpha]_{\mathcal{B}}=[0,1,1,0,\cdots,0]^{T} \\
 & [\alpha ^{64}]_{\mathcal{B}}=[0,\cdots ,0,1_{(65)},0,\cdots ,0]^{T}\text{ and }[\phi(\alpha)]_{\mathcal{B}}=[1,1,1,0,0,0,0,1,0,\cdots ,0]^{T}
\end{align}
$$
since the primitive polynomial of AES-GCM is $f(x)=x^{128}+x^{7}+x^{2}+x+1$. 

Since all information in $GF(2^{128})$ is represented by 128-bit data using basis $\mathcal{B}$, we only need to consider the linear transformation $Mz=K$. $Mz=z^{2}+z=z(z+1)=0$ if and only if $z=0$ or $1$. Then $ker(M)=\left\{ 0,1 \right\}$, there are exactly 2 feasible solutions. All we need is to use Gaussian Elimination to get $z$, then use $H=Bz$ to get $H$.

Use `python iv_reused_attack_c.py` to run this demo, the output should look like

```bash
--- STEP 1: Intercepting Traffic (3 Messages for Disambiguation) ---
[*] AAD: 'BankProtocol:v1'
[*] Msg 1: 'Pay David $100' (Len: 112 bits)   | Tag: 5a1d01cc6b836d88a18a6e5292416363
[*] Msg 2: 'Pay Bob   $2000 ' (Len: 128 bits) | Tag: 06c84b10afba95ca5ded6291e2495334
[*] Msg 3: 'Balance Query' (Len: 104 bits)    | Tag: fbc6b1991eae59327304b79bd410be93 (Verifier)

--- STEP 2: Mathematical Derivation (Quadratic Equation) ---
[!] Quadratic Equation: A*x^2 + B*x + C = 0
    Coeff A (Delta C): 00000000060e1449440000030000c226
    Coeff B (Delta L): 000000000000000000000000000000f0
    Coeff C (Delta T): 5cd54adcc439f842fc670cc370083057
[*] Solving equation using Gaussian Elimination over GF(2)...
[*] Found 2 candidate roots for H.

--- STEP 3: Disambiguation (Finding the Real H) ---
    [MATCH] Candidate #1 validates against Msg 3!
    -> H:      b83b533708bf535d0aa6e52980d53b78
    -> Ek(J0): 3247184b3c4f69a44dbcd22887bbb418

--- STEP 4: Forgery ---
[*] Target Forged Message: 'Pay Eve $9999999'
[*] Forged Ciphertext: cbd355c79c8517e1ca12114b121ccb3f
[*] Forged Tag:        9aff8dfaab6bc2bec583f5d1155e6422

--- STEP 5: Bank Verification ---
[SUCCESS] Bank System: MAC verification PASSED!
[SUCCESS] Bank executing instruction: 'Pay Eve $9999999'
```

### IV Collision
Two different packets may have the same IV if the IV is randomly selected. By the **Birthday Paradox**, given the set $S=\left\{ e_{1},e_{2},\cdots,e_{d} \right\}$ and the random sequence $x=(x_{1},\cdots,x_{n})$ with $x_{i}=e_{j}$ for some $1\leq j\leq d$ and for all $1\leq i\leq n$, we have
$$
P(A)=P\left\{x_{i}= x_{j},\text{ for some }i\neq j \right\} =1-\frac{d!}{d^{n}(n-d)}(\text{if }d<n);\text{ else }P(A)=1
$$
$e^{-x}\approx 1-x$ as $x\to 0$, for $d$ large enough while n relatively small, rewrite $P(A)$ as 
$$
P(A)\approx1-e^{-0/d}e^{-1/d}\cdots e^{-(n-1)/d}\approx 1-e^{-n(n-1)/(2d)}\approx 1-e^{-\frac{n^{2}}{2d}}
$$
If the random $IV\in \left\{ 0,1 \right\}^{N}$ and $k$ packets are captured, the possibility to collide is round to 
$$
P(A)\approx 1-e^{-\frac{k^{2}}{2^{N+1}}}
$$
If $k=2^{N/2}$, $P(A)\approx 1-e^{-1/2}\approx 0.39$, which is a very high possibility. 

In TLS 1.2, the IV is composed of 4-byte salt and 8-byte explicit nonce. Many developers decide to randomly generate the 8-byte explicit nonce. All packets in the same session have the same salt. Therefore the randomness of IV during the same session is only $2^{64}$. As long as the packets are more than $2^{32}$, it is likely to have the collision. The active server may only spend a few minutes or a few hours to reach the bound of $2^{32}$, hence it is very dangerous.

In TLS 1.3, IV = write_IV $\oplus\, 0^{4}\parallel$sequence_number. Here, write_IV can be treated as a 12-byte salt and the sequence number is a 8-byte incremented counter. This design totally avoid the possibility of collision in a reasonable amount of time. Besides, the IV becomes implicit and is calculated locally  by the sender and receiver. The attacker can not recognize whether IV is reused anymore.

### Classic Forbidden Attack
For the attacker during 2012-2015 (TLS 1.2 + Mixed HTTP & HTTPS), he can use the **forbidden attack** to masquerade as a server. From the user's perspective, everything looks flawless without any warnings. However, the attacker might inject malicious script to steal user's cookies, sessions tokens and saved passwords.

1. The attacker goes to the Starbucks and becomes the Man-in-the-Middle (MITM) using the ARP Spoofing. Then the router's IP is linked to the attacker's device MAC in user's device ARP table.  The attacker is able to check and modify all packets between the user and the server now. (User -- Attacker -- Router -- Server): Some unlucky customers connect to the attackers `Starbucks-Free` wifi.
2. Although https is highly recommended at that time, many https websites will require http resources to be compatible with older plugins or simply for convenience:  One user opens the `https://bank.com`. The attacker finds this page is trying to load a script using `<script src="http://static.com"></script>`. Then he captures the response `jquery.js`, replaces it by the looping bank website fetching script and sends it back to the user. The `jquery.js(attacker version)` is carefully designed. As long as the user doesn't close the pages, the user's browser will send the fetch request to the target website. 
3. The attacker wants to get the known plaintext-ciphertext pair as large as possible. However, the response packets from the server to the user is encrypted. The construction idea of the fake `jquery.js` is to use the structure and predictable design of the websites. For example, the response of the `search` operation under the `bank.com` may always be of the form `[fixed length header][<div>the searching result</div>]...`. The attacker can send a packet with `GET /search?q=AAAA......AAAAA (1000 bits)` to the bank's website and capture the response packet from the server on his own device first. By comparing the plaintext and the ciphertext, the attacker is able to find out the place of encrypted header, searching result and the footer. Then, the attacker can let the `jquery.js(attacker version)` to keep `GET /search?q=AAAA......AAAAA` to the bank's server and use this to get many partially known plaintext-ciphertext pair with corresponding explicit IV.
4. Because TLS 1.2 didn't forbidden the randomly generation of IV, many servers at that time generate random explicit IV, some even with old PRNG (Pseudo-Random Number Generator) libraries or APIs. These outdated PRNGs fail to generate sufficiently random numbers, leading to a significantly increased probability of collisions.
5. The attacker will use script to automatically capture all repeated IVs from the user and calculate the all possible $H$ using **Berlekamp's algorithm**. Finally the attacker gets the unique correct $H$ in this TLS session by several repeated pairs of IVs. The attacker restores the partial keystream by $E_{k}(J_{i})=C_{i}\oplus M_{i}(1\leq i\leq n)$. $KnownInfo(IV,KeyStream,E_{k}(J_{0}))$ is the database used to store all known $IV$, corresponding partial keystream, $E_{k}(J_{0})$.
6. The user continues working on the `https://bank.com`. Another program in attacker's device is listening on all TLS packets from the server to the user. As long as the program captures one packet with explicit nonce recorded at the $KnownInfo$, the attacker can partially replace the ciphertext and the tag by the forged information: $C_{\text{fake}}=M_{\text{fake}}\oplus KeyStream$ and $T_{\text{fake}}=E_{k}(J_{0})\oplus f_{A_{\text{fake}},C_{\text{fake}}}(H)$. The attacker only needs to modify part of the whole message to inject malicious script.

Since in step 2 we've already modified the `jquery.js` and finished the injection process, why we need to inject malicious script at the bank.com in such a complicated way?  The problem comes from the `Same-Origin Policy`, `jquery.js` comes from the `http://static.com` and does not have the sufficient permission to retrieve user data of `https://bank.com` from user's browser. However, after we inject malicious script to the response packets from bank.com, the user's browser will treat them as the official requirement from the server.

If unluckily, the bank.com uses old server and automatically reset the explicit nonce to 0 whenever re-establishing the connection to the user. The attacker can easily control the IVs as follows:
1. The attacker sends the fake server's TCP RST packet to the user. 
2. The user's browser treats the fake TCP RST packet as the cut down connection instruction from the server and performs the operation.
> The encrypted HTTPS/TLS packets (in application layer) are wrapped inside the TCP packets (in transport layer). There's no certification or authentication for TCP protocols. Hence, the attacker only need to construct the TCP RST packet with correct resource, destination IPs, ports and the sequence number (which can be captured for MITM)
3. The looping forces the user to re-establish connection with the bank's website. 
4. The next packet from server has 0 nonce almost surely. 
5. The user's browser usually recovers previous sessions by session-ID, the key and the salt are not changed. 
6. The attacker is able to predict and control the explicit IV. Forging messages becomes very easy.

Nowadays, it's nearly impossible to do the forbidden attack since HTTPS and TLS 1.3 standards are followed by all major browsers and servers. TLS 1.0 and 1.1 are totally abandoned. And TLS 1.2 is deprecated or strictly hardened. JavaScript injection via HTTP is also strictly blocked.

# Conclusion
In conclusion, AES-GCM is a high-performance but fragile cipher. It is a typical trade-off between robustness and performance. Finally, we accept this trade-off in TLS 1.3 by establishing very strict rules to ensure the attacker is impossible to know the reuse of nonce.

# Acknowledgement
Thanks to Peiqi Qin for spotting a typo, and to Prof. Yue Zheng for helping refine the logic regarding the lack of authentication and certification requirements for TCP packets.