- Course: MAT4007 Introduction to Cryptography
- Instructor: Dr. Yue Zheng 
- Author: Linzheng Tan

In class, we learn the basic implementation of the PRGs (pseudo-random generators) using the LFSRs (linear feedback shift registers). One n-stage LFSR have $2^{n}-1$ states by carefully designing the position of the taps. In this supplementary materials, we will gain some mathematical intuition of the mathematical principles (check abstract algebra textbooks for more detailed and rigorous proofs) behind the LFSRs and explain why we can produce $2^{n}-1$ different stages. 

Before we move on to the groups and fields, let's first talk about the key idea. The LFSRs we learnt in class, in precise, is the Fibonacci LFSRs. There's another type of LFSRs, called the Galois LFSR. Following two graphs show the Fibonacci first, then the Galois 16-bit LFSR. [^1]
![Fibonacci LFSR (diagram)](../assets/Fibonacci_LFSR1.png)
![Galois LFSR (diagram)](../assets/Galois_LFSR1.png)
[^1]: [Image Source](https://en.wikipedia.org/wiki/Linear-feedback_shift_register)

Both designs create an isomorphism between the set of all states together with the $\mathbb{F}_{2^{n}}$. The Galois LFSRs idea is straight forward, the $i-$th register stores the $i-$th coefficient of the polynomial. Then we use the state $s$ to uniquely define the function $g(x)$ in $\mathbb{Z}_{2}[x]/\left< f(x) \right> (\cong \mathbb{F}_{2^{n}})$, where $f(x)$ is the primitive polynomial in $\mathbb{Z}_{2}[x]$ with degree $n$. While the Fibonacci LFSRs is not that simple, the states represent the result of a special trace function. And all possible results have a one-to-one correspondence towards all elements in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$. 

# Necessary Mathematics I
In this section, we will talk about the necessary mathematics knowledge using analogy and simple examples, don't worry if you haven't learn abstract algebra.

**Quotient space**: $\mathbb{Z}_{2}[x]/\left< f(x) \right>$

In our specific topic, you can treat quotient as "modulo". For any element, we can remove the fixed large opponent and the rest can "project" into a smaller space. For any integer $a\in \mathbb{Z}$, given a fixed number $n$, we have $a=qn+r$, where $0\leq r<n$ and $q\in \mathbb{Z}$. Then all such $r$ forms the set $\mathbb{Z}/\left< n \right>=\mathbb{Z}_{n}$, where $\left< n \right>=\left\{ qn: q\in \mathbb{Z} \right\}$.  For example, if $n=2$, then $4=6$ in $\mathbb{Z}_{n}$ ($4=6\text{ mod }2$)

Let's look at the polynomials with characteristics in $\mathbb{Z}_{2}$ ($\mathbb{Z}_{2}[x]$), all elements in it can be written as 
$g(x)=\sum_{i=0}^{n}g_{i}x^{i}$ for some $n\in \mathbb{N}$ and $g_{i}\in \mathbb{Z}_{2}=\left\{ 0,1 \right\}$. For any $g(x)\in \mathbb{Z}_{2}[x]$, given a fixed polynomial $f(x)$ with degree $n$ (degree is the largest $i$ for $g_{i}\neq 0$), we have
$$
g(x)=q(x)f(x)+r(x), q(x),r(x)\in \mathbb{Z}_{2}[x]\text{ and }\text{deg}(r(x))<\text{deg}(f(x))
$$
For example, if $f(x)=x^{2}+x+1$, then $x^{2}=x^{2}+2x+2=f(x)+x+1$. Do this for all elements, we get the quotient space $\mathbb{Z}_{2}[x]/\left< f(x) \right>$, where $\left< f(x) \right>=\left\{ q(x)f(x):q(x)\in \mathbb{Z}_{2}[x] \right\}$. All elements in $\mathbb{Z}_{2}[x]$ can be represented using $r(x)$:
$$
g(x)=\sum_{i=0}^{n-1} r_{i}x^{i},r_{i}\in \left\{ 0,1 \right\} 
$$
Moreover, if the $f(x)$ is irreducible, $\mathbb{Z}_{2}[x]/\left< f(x) \right>$ is a finite field. Field is just a set of elements that have nice behaviours under operation $+$ and $\times$. Let's consider the $\mathbb{Z}_{7}=\mathbb{Z}/\left< 7 \right>$, where $7$ is also irreducible and $\mathbb{Z}_{7}$ is a field:

1. $\forall a,b\in \mathbb{Z}_{7},a+(b+c)=(a+b)+c$
2. $\exists e=0\in \mathbb{Z}_{7},\forall a\in \mathbb{Z}_{7},a+e=e+a=a$
3. $\forall a\in \mathbb{Z}_{7},\exists b=-a$ such that $a+b=0=e$
4. $\forall a,b\in \mathbb{Z}_{7}$, $a+b=b+a$
5. $\forall a,b,c\in \mathbb{Z}_{7},(a\cdot b)\cdot c=a\cdot(b\cdot c)$
6. $\forall a,b,c\in \mathbb{Z}_{7},a\cdot(b+c)=ab+ac,(b+c)\cdot a=ba+ca$
7. $\forall a,b\in \mathbb{Z}_{7}$, $a\cdot b=b\cdot a$
8. $\exists e_{1}=1\in \mathbb{Z}_{7}$, $\forall a\in \mathbb{Z}_{7}$, $a\cdot e_{1}=e_{1}\cdot a=a$
9. $\forall a\in \mathbb{Z}_{7}\setminus \left\{ 0 \right\}$, $\exists b=a^{-1}$ such that $a^{-1}\cdot a=a\cdot a^{-1}=1$ 

Notice that for $\mathbb{Z}_{4}$, because $4=2\cdot 2$ is reducible, rule 8 is not met: for $2$, $2\cdot 0=0,$ $2\cdot 1=2$, $2\cdot 2=4=0$ and $2\cdot 3=2$. We can't find the inverse of $2$. In fact, $\mathbb{Z}_{n}$ is a field if and only if $n$ is irreducible.  

You can just view this rules as a guarantee to get some interesting results. The reason we abstract the concrete examples $\mathbb{Z}_{7}$ to a set $\mathbb{F}$ together with two operations and a bunch of rules is that, any structures satisfying these share the exactly same properties. You can treat the field as the class and $\mathbb{Z}_{7}$ as the instance in OOP. 

If a polynomial $f(x)\in \mathbb{Z}_{2}[x]$ is irreducible, then if $f(x)=h(x)k(x),h(x),k(x)\in \mathbb{Z}_{2}[x]$, one of $h(x)$ and $k(x)$ must be constant.  $\mathbb{Z}_{2}[x]/\left< f(x) \right>$ is another instance of class field, it holds the similar properties as $\mathbb{Z}_{7}$. 

Besides, $\mathbb{Z}_{2}[\alpha]\cong \mathbb{Z}_{2}[x]/\left< f(x) \right>$ where $\alpha$ is the root of $f(x)$. Isomorphism ($\cong$) indicates that you can use the left side to represent the right side precisely, or vice versa. Elements in $\mathbb{Z}_{2}[\alpha]$ is of the form $\sum_{i=0}^{n-1}c_{i}\alpha ^{i}$ where $c_{i}\in \left\{ 0,1 \right\}$. The motivation to use this isomorphism is simple: we have 
$$
f(x)=\sum_{i=0}^{n} f_{i}x^{i}=0\text{ in } \mathbb{Z}_{2}[x]/\left< f(x) \right>\implies f(\alpha)=\sum_{i=0}^{n} f_{i}\alpha ^{i}=0\text{ in }\mathbb{Z} \text{ for root }\alpha
$$

Generally, if we want $\mathbb{Z}_{n}[x]/\left< f(x) \right>$ to be a field, we need $n$ to be the prime ($\mathbb{Z}_{n}$ is a field) and $f(x)$ is irreducible in $\mathbb{Z}_{n}[x]$. 

Consider $n=4$, then $2\in \mathbb{Z}_{4}[x]/\left< f(x) \right>$ for all $f(x)$ with order larger than 0, we can't find the inverse of $2$. 

Consider $n=3$ but $f(x)=x^{2}+x+1$, then take $h(x)=x-1$ and $g(x)=x+2$
$$
h(x)g(x)=x^{2}+x-2=f(x)
$$
Now, $h(x)$ and $g(x)$ are all nonzero elements in $\mathbb{Z}_{3}[x]/\left< f(x) \right>$, but $h(x)g(x)=0$, which is impossible in the field. Otherwise,
$$
\exists h^{-1},g^{-1},s.t.(h^{-1}h)(gg^{-1})=1\cdot 1=1=h^{-1}(hg)g^{-1}=h^{-1}\cdot 0\cdot g^{-1}=0\implies 1=0
$$
Then $\alpha(x)=\alpha(x)\cdot 1=\alpha(x)\cdot 0=0$ for all $\alpha(x) \in \mathbb{Z}_{3}[x]/\left< f(x) \right>$

**Primitive elements and primitive polynomials**

Given an element $\alpha$ in a group $G$, if $\left< \alpha \right>=G$, we say $\alpha$ is the primitive element in $G$. The group is a set together with one operation with specific properties. For example, $\mathbb{Z}_{7}=\left\{ 0,1,2,\cdots,6 \right\}$ is a group with the operation $+$, because 
1. for all $a,b,c\in \mathbb{Z}_{7}$, $(a+b)+c=a+(b+c)$
2. $\exists e=0\in \mathbb{Z}_{7}$, such that $e+a=a+e$ for all $a\in \mathbb{Z}_{7}$
3. $\forall a\in \mathbb{Z}_{7}$, $\exists b=-a$ such that $a+ (-a)=0=e$

You might already notice that a field is just a group with another operation $\times$ and some advanced properties. Here, although we still use $\left<\alpha  \right>$ as the notation, it's not like $\left< f(x) \right>$. Under the content of group, $\left< \alpha \right>=\left\{ \alpha ^{n}:n\in \mathbb{N} \right\}$ represents $\alpha+\cdots+\alpha$ for $n$ $\alpha s$.  For $(\mathbb{Z}_{7},+)$, we have 
$$
1^{n}=1\cdot n = n \implies \left< 1 \right> =\left\{ 1,2,\cdots ,6,0 \right\} =\mathbb{Z}_{7}
$$
Hence 1 is the primitive element of $\mathbb{Z}_{7}$. In fact, because $\text{gcd}(\alpha,7)=1$ for all $\alpha \in \mathbb{Z}_{7}\setminus \left\{ 0 \right\}$, we have $\left< \alpha \right>=\mathbb{Z}_{7}$ for all elements except $0$. We call the smallest positive integer $n$ satisfying $\alpha ^{n}=e$ as the order of $\alpha$, denoted as $\left| \alpha \right|$. For the primitive element $1$ in $(\mathbb{Z}_{7},+)$, $1\cdot 7=0$ in $\mathbb{Z}_{7}$ and $n\cdot 1\neq 0$ for all $0< n<7$. 

Another example is $\mathbb{Z}_{7}\setminus \left\{ 0 \right\}$ with operation $\times$, denoted as $(\mathbb{Z}_{7})^{\times}$. The unit $e$ is $1$ and the primitive elements of $(\mathbb{Z}_{7})^{\times}$ are $3$ and $5$. Take $3$ as the example, we have 
$$
\left\{ 3,3^{2},3^{3},3^{4},3^{5},3^{6} \right\}=\left\{ 3,2,6,4,5,1 \right\}
$$
while $2^{3}=1(\text{ mod 7})$ shows 2 is not primitive.

Given an irreducible polynomial $f(x)\in \mathbb{Z}_{2}[x]$, if $x$ is the primitive element in $\left( \mathbb{Z}_{2}[x]/\left< f(x) \right> \right)\setminus \left\{ 0 \right\}$ with $\times$ as the operation, we say $f(x)$ is the primitive polynomial of $\mathbb{Z}_{2}[x]$. If we represent $\mathbb{Z}_{2}[x]/\left< f(x) \right>$ by $\mathbb{Z}_{2}[\alpha]$, we can say $f(x)$ is the primitive polynomial of $\mathbb{Z}_{2}[x]$ if the root $\alpha$ is the primitive element in the group $(\mathbb{Z}_{2}[\alpha]\setminus \left\{ 0 \right\}, \times)$. 

**Lagrange Theorem**

Given a finite group $G$, $\left| \alpha \right| \mid \left| G \right|$ for all $\alpha \in G$ ($\left| G \right|=\left| \alpha \right|\cdot k$, for some $k\in \mathbb{Z}$). Consider group $\mathbb{Z}_{4}$with operation $+$, $\left| \mathbb{Z}_{4} \right|=4$, $\left| 0 \right|=1,\left| 1 \right|=4,\left| 2 \right|=2$ and $\left| 3 \right|=4$.

**Taps check**

At this stage, we are able check the config of the taps is exactly the primitive polynomial. [^2]
![Fibonacci LFSR taps](../assets/Fibonacci_LFSR2.png)
[^2]: Image Source: lecture_4, page_13

In this example, the corresponding polynomial is $f(x)=x^{4}+x+1$. Suppose $f(x)=h(x)k(x)$, if we can't find such $h(x)$ with $\text{deg}(h(x))=1$ or $2$, we conclude $f(x)$ is irreducible. 

For any polynomial $f(x)\in \mathbb{Z}_{2}[x]$, $f(x)=(x-\alpha)g(x)$ if and only if $f(\alpha)=0$: 
$$
\begin{align}
 & f(x)=(x-\alpha)g(x)\implies f(\alpha)=0\cdot g(x)=0 \\
 & f(x)=(x-\alpha)g(x)+r\text{ for some }g(x)\in \mathbb{Z}_{2}[x], \text{ if }f(\alpha)=0 \implies f(\alpha)=r=0 \\
 & \implies f(x)=(x-\alpha)g(x)
\end{align}
$$
Then, check $f(1)=1$ and $f(0)=1$, we conclude $\text{deg}(h(x))\neq 1$. 

Then we may try irreducible $h(x)$ with degree 2. To find this irreducible $h(x)$, we only need to enumerate all possible $h(x)$ with degree 2 and check whether it is irreducible. It is irreducible if and only if $h(a)\neq 0$ for all $a\in \mathbb{Z}_{2}$ by previous statements. For example, try $h(x)=x^{2}+1$, then $h(1)=0$, then $h(x)=(x+1)^{2}, h(x)$ is therefore reducible. The only possible $h(x)$ is $h(x)=x^{2}+x+1$.
$$
x^{4}+x+1=(x^{2}+x+1)(x^{2}+x)+1\implies f(x) \text{ is irreducible}
$$

Now we check $x$ is primitive element in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$. Recall that by Lagrange Theorem, $\left| x \right|\mid \left| (\mathbb{Z}_{2}[x]/\left< f(x) \right>)\setminus \left\{ 0 \right\} \right|=\left| x \right|\mid 2^{4}-1=\left| x \right|\mid 15$. Hence $x$ is not the primitive element if and only if $\left| x \right|=1,3$ or $5$. $\left| x \right|\neq 1$ clearly, notice that $-x^{4}=x^{4}=x+1$ in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$, we can use $x+1$ to substitute $x^{4}$ to simplify the calculation
$$
\begin{align}
 & x^{3}=x^{3}(\text{ mod } f(x) )\neq 1 \\
 & x^{5}=x(x^{4})= x(x+1)=x^{2}+x(\text{ mod }f(x) )\neq 1
\end{align}
$$
Hence we conclude $f(x)$ is the primitive polynomial in $\mathbb{Z}_{2}[x]$

# Galois LFSRs
Now we can be very confident to understand the mechanism behind the Galois LFSRs [^3] 
![Galois LFSR example](../assets/Galois_LFSR2.png) 
[^3]: [Image Source](https://en.wikipedia.org/wiki/Linear-feedback_shift_register)

The primitive polynomial in $\mathbb{Z}_{2}[x]$ is $f(x)=x^{8}+x^{4}+x^{3}+x^{2}+1$. In current state, the LFSR represent $g(x)=x^{7}+x^{5}+x^{4}+x+1$ in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$. In other words, at current cycle $t$,  
$$ S_{t}=\begin{bmatrix} s_{t+7},s_{t+6},s_{t+5},s_{t+4},s_{t+3},s_{t+2},s_{t+1},s_{t}  \end{bmatrix}\text{ represents } g_{t}(x)= \sum_{i=1}^{n-1} s_{t+i}x^{i} 
$$
At next cycle $t+1$, we shift all data to left, the output $1$ will XOR with bits at $x^{4}$, $x^{3}$, $x^{2}$ and $1$. Since the XOR operation is + in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$ and $x^{8}=f(x)-x^{8}$ in $\mathbb{Z}_{2}[x]/\left< f(x) \right>$, we have: 
$$
x\cdot g(x)=x^{6}+x^{5}+x^{2}+x+x^{4}+x^{3}+x^{2}+1=x^{6}+x^{5}+x^{4}+x^{3}+x+1  
$$
In other words, the next state should be  
$$ 
S_{t+1}=\begin{bmatrix} 0,1,1,1,1,0,1,1
\end{bmatrix}
$$
Hence, at any cycle $t$, we have $g_{t}(x)=x^{t}\cdot g_{0}(x)$. By definition of the primitive polynomial $f(x)$, we notice that $x$ is the primitive element in the multiplicative group of $\mathbb{Z}_{2}[x]/\left< f(x) \right>$. Then the order of $\left| x \right|$ is $2^{n}-1$. Hence for all $g_{0}(x)\neq 0$, $g_{0}(x)=x^{k}$ for some $k\in \mathbb{N}^{+}$. Therefore, as long as the initial state $S_{0}$ is not zero, the Galois LFSRs will traverse all elements in $\mathbb{Z}_{2}[\alpha]\setminus\left\{ 0 \right\}$ every $2^{n}-1$ cycles. 

# Necessary Mathematics II 

Consider the field $\mathbb{Z}_{p}[x]/\left< f(x) \right>\cong \mathbb{Z}_{p}[\alpha]$, it can be treated as the vector space with basis $\left\{ 1,\alpha,\cdots,\alpha ^{p-1} \right\}$ over the field $\mathbb{Z}_{p}$. 

>More generally, all finite fields can be treated as the vector space over its prime subfield.

**linear functional**
A function $f:V\to K$ is a linear functional (one type of special linear transformation) if $V$ is a vector space over a field $K$, and it satisfies
1. for all $u,v\in V$, $f(u+v)=f(u)+f(v)$
2. for all $u\in V,c\in K$, $f(cu)=cf(u)$

**Trace Function**
The trace functional $\text{Tr}:\mathbb{Z}_{p}[\alpha] \to \mathbb{Z}_{p}$ is a linear functional that defined by 
$$
\text{Tr}(x)=\sum_{i=0}^{n-1}x^{p^{i}} =x+x^{p}+x^{p^{2}}+\cdots +x^{p^{n-1}}
$$
Check the linearity: for all $u,v\in \mathbb{Z}_{p}[\alpha]$, 
$$
(u+v)^{p}=\sum_{i=0}^{p} \binom{p}{i}u^{i}v^{p-i}=u^{p}+v^{p}\text{ since }p=0 
$$
Suppose $(u+v)^{p^{i}}=u^{p^{i}}+v^{p^{i}}$, then $(u+v)^{p^{i+1}}=(u^{p^{i}}+v^{p^{i}})^{p}=u^{p^{i+1}}+v^{p^{i+1}}$. Mathematical induction indicates that $\text{Tr}(u+v)=\text{Tr}(u)+\text{Tr}(v)$. 

$(\mathbb{Z}_{p})^{\times}=(\mathbb{Z}_{p}\setminus \left\{ 0 \right\},\times)$ is a multiplicative group, then $\forall c\in(\mathbb{Z}_{p})^{\times}$, $\left| c \right|\mid p-1\implies c^{p-1}=1$. Hence $c^{p}=c$, then by similar induction process we have $c^{p^{i}}=c$ for all $i \in \mathbb{N}$. For $c=0$, clearly $\text{Tr}(0\cdot u)=\text{Tr(0)}=0$, then $\text{Tr}(cu)=c\text{Tr}(u)$ for all $c\in \mathbb{Z}_{p}$ and $u\in \mathbb{Z}_{p}[\alpha]$

**Fibonacci LFSRs' Linear Transformation**

Consider the linear transformation $L:\mathbb{Z}_{p}[\alpha]\to \mathbb{Z}_{p}^{n}$ defined by 
$$
L(x)=
\begin{bmatrix}
\text{Tr}(x\cdot 1) \\
\text{Tr}(x\cdot \alpha) \\
\text{Tr}(x\cdot \alpha ^{2}) \\
\cdots  \\
\text{Tr}(x\cdot \alpha ^{n-1})
\end{bmatrix}
$$
$L(x)$ is a linear transformation clearly since $\text{Tr}(x)$ is a linear functional. Now we want to show $L$ is bijective. 

Suppose $\exists a \in \mathbb{Z}_{p}[\alpha]$ such that $L(a)=\vec{0}$, then $\text{Tr}(a\cdot \alpha ^{i})=0,$ for $\forall 0\leq i\leq n-1$. Since $\left\{ 1,\alpha,\alpha ^{2},\cdots,\alpha ^{n-1} \right\}$ is the basis of $\mathbb{Z}_{p}[\alpha]$, for any $b\in \mathbb{Z}_{p}[\alpha]$, we have 
$$
b=\sum_{i=0}^{n-1} b_{i}\alpha ^{i}, b_{i}\in \mathbb{Z}_{p}\implies \text{Tr}(ab)=\sum_{i=0}^{n-1} b_{i}\text{Tr}(a\cdot \alpha ^{i})=0
$$
Then we find $a\in \mathbb{Z}_{p}[\alpha]$ such that $\text{Tr}(ab)=0$ for all $b\in \mathbb{Z}_{p}[\alpha]$. 

Consider the trace function $\text{Tr}(x)$, $\text{Tr}(x)$ has at most $p^{n-1}$ roots according its degree, which means there are at least $p^{n}-p^{n-1}$ elements don't map to 0 via the trace function. 

$\mathbb{Z}_{p}[\alpha]$ is a finite field, let $a\neq 0$, as $b$ ranges over the entire field, if $ab$ fails to range over $\mathbb{Z}_{p}[\alpha]$, we must have $c=ab_{1}=ab_{2}$ for distinct $b_{1},b_{2}$, however $b_{1}=a^{-1}\cdot c$ and $b_{2}=a^{-1}\cdot c$. We conclude $ab$ also ranges over $\mathbb{Z}_{p}[\alpha]$. $\text{Tr}(ab)=0$ for all $b\in \mathbb{Z}_{p}[\alpha]$, then $\text{Tr}(x)=0$ for all $x\in \mathbb{Z}_{p}[\alpha]$, which is impossible. Hence $a=0$. Suppose $L(x_{1})=L(x_{2}),x_{1},x_{2}\in \mathbb{Z}_{p}[\alpha]$, then $L(x_{1}-x_{2})=0$, we have $x_{1}-x_{2}=a=0$. $L$ is injective, The kernel of $L$ is $\left\{ 0 \right\}$.

By dimension theorem, since $\text{dim}(\mathbb{Z}_{p}[\alpha])=\text{dim}(\mathbb{Z}_{p}^{n})=n$, $L$ is surjective. 

# Fibonacci LFSRs
Now we are well-prepared for learning the mechanism behind the Fibonacci LFSRs [^4]
![Fibonacci LFSR mechanism](../assets/Fibonacci_LFSR3.png)
[^4]: [Image Source](https://www.moria.us/articles/demystifying-the-lfsr/)

The primitive polynomial is $f(x)=x^{8}+\sum_{i=0}^{n-1}f_{i}x^{i}=x^{8}+x^{4}+x^{3}+x^{2}+1$ (same as the Galois one). The state $S_{t}=[0,1,1,1,0,0,0,0]$ represents $L(\beta_{t})$ for some specific $\beta_{t} \in \mathbb{Z}_{2}[\alpha]$. At next cycle $t+1$, data in the LFSR moves right, and the data from 0th-bit, 2nd-bit, 3rd-bit and the 4th-bit are XOR together and output to the 7th-bit. Recall the XOR operation is just the addition in $\mathbb{Z}_{2}[\alpha]$. The generated bit is actually
$$
\sum_{i=0}^{n-1} f_{i}\text{Tr}(\beta_{t}\alpha ^{i})=\text{Tr}\left( \beta_{t}\sum_{i=0}^{n-1} f_{i}\alpha ^{i} \right)=\text{Tr}(\beta_{t}\alpha ^{8})=\text{Tr}(\beta_{t+1}\alpha ^{7})
$$
For the rest 0th-bit to the $(n-1)$th-bit, at $i$th-bit 
$$
\text{Tr}(\beta_{t}\alpha ^{i})\to \text{Tr}(\beta_{t}\alpha ^{i+1})=\text{Tr}(\beta_{t+1}\alpha ^{i})\text{ because of the right shift}
$$
At next state, $S_{t+1}=[\text{Tr}(\beta_{t+1}\alpha ^{n-1}),\cdots,\text{Tr}(\beta_{t+1}\alpha),\text{Tr}(\beta_{t+1})]$. Hence, at each cycle $t$, we have $\beta_{t}=\beta_{0}\alpha ^{t}$. Since $L$ is a bijective linear transformation, it must be invertible. We can get $\beta_{0}$ from $S_{0}$ theoretically. Then, since $\alpha$ is the primitive element of $(\mathbb{Z}_{2}[\alpha])^{\times}$, $\left| \alpha \right|=2^{n-1}$. Then, for all $\beta_{0}\neq 0$, $\beta_{0}=\alpha ^{k}$ for some $k\in \mathbb{N}^{+}$, and $\beta_{t}$ will traverse all elements in $(\mathbb{Z}_{2}[\alpha])^{\times}$ every $2^{n}-1$ cycles. Since $L$ is bijection, $S_{t}$ will traverse all elements in $\mathbb{Z}_{p}^{n}$ except $[0,0,\cdots,0]$ every $2^{n}-1$ cycles. In other words, as long as $S_{0}$ is not $[0,0,\cdots,0]$, the Fibonacci LFSRs will have a period of $2^{n}-1$. 

# At Last 
Congratulations! Now you understand the excellent design philosophy behind two types of LFSRs.
