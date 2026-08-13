/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // next/image needs every external host it's given explicitly allow-
    // listed. Firebase Storage download URLs cover every uploaded photo
    // (products, banners, reviews, seller branding, support attachments).
    // googleusercontent.com covers components/site-header.tsx's
    // <Image src={user.photoUrl}> — a Google Sign-In user who never
    // uploaded a custom photo has Firebase Auth's own photoURL pointing
    // straight at their Google account picture, not Firebase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
}

export default nextConfig
