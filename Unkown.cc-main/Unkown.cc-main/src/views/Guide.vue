<template>
  <div class="container">
    <div style="margin-bottom:18px">
      <a href="/" style="color:#00ff88;text-decoration:none">← Back to Forum</a>
    </div>
    
    <h1 style="margin:0 0 24px;color:#00ff88">Registration Guide</h1>
    
    <div style="max-width:720px">
      <div style="background:var(--card);padding:20px;border-radius:8px;border:1px solid rgba(0,255,136,0.1);margin-bottom:18px">
        <h2 style="margin-top:0;color:#00ffcc">How to Join</h2>
        <p>To register on Unknown.cc, you need one thing: an <strong>invitation key</strong> from an administrator.</p>
      </div>
      
      <div style="background:var(--card);padding:20px;border-radius:8px;border:1px solid rgba(0,255,136,0.1);margin-bottom:18px">
        <h3 style="margin-top:0;color:#00ff88">Step 1: Get an Invitation Key</h3>
        <p style="margin:8px 0">An admin must generate an invitation key for you. Keys are 16-digit codes that look like:</p>
        <div style="background:rgba(0,255,136,0.1);padding:12px;border-left:3px solid #00ff88;border-radius:4px;font-family:monospace;color:#00ff88;font-weight:600">
          1234567890123456
        </div>
        <p style="margin:12px 0 0;color:#9bb0bd;font-size:14px">Copy this key and keep it safe—it's like a password to create your account.</p>
      </div>
      
      <div style="background:var(--card);padding:20px;border-radius:8px;border:1px solid rgba(0,255,136,0.1);margin-bottom:18px">
        <h3 style="margin-top:0;color:#00ff88">Step 2: Create Your Account</h3>
        <ol style="margin:10px 0;padding-left:20px">
          <li style="margin-bottom:8px">
            <strong>Username</strong> - Choose your public name (3-25 alphanumeric characters)
          </li>
          <li style="margin-bottom:8px">
            <strong>Email</strong> - Enter a valid email address
          </li>
          <li style="margin-bottom:8px">
            <strong>Password</strong> - Create a secure password (minimum 6 characters)
          </li>
          <li style="margin-bottom:8px">
            <strong>Confirm Password</strong> - Re-enter your password to confirm
          </li>
          <li>
            <strong>Invitation Key</strong> - Paste the 16-digit key you received from an admin
          </li>
        </ol>
      </div>
      
      <div style="background:var(--card);padding:20px;border-radius:8px;border:1px solid rgba(0,255,136,0.1);margin-bottom:18px">
        <h3 style="margin-top:0;color:#00ff88">Step 3: You're In!</h3>
        <p style="margin:8px 0">Once you submit, your account is created and you'll get:</p>
        <ul style="margin:8px 0;padding-left:20px">
          <li style="margin-bottom:8px">A unique ID (UID) number</li>
          <li style="margin-bottom:8px">Access to browse threads and posts</li>
          <li style="margin-bottom:8px">The ability to create threads and reply to posts</li>
          <li>A profile you can customize with a profile picture, banner, signature, and custom rank</li>
        </ul>
      </div>
      
      <div style="background:rgba(0,255,136,0.1);padding:20px;border-radius:8px;border-left:4px solid #00ff88;margin-bottom:18px">
        <h3 style="margin-top:0;color:#00ff88">Special Cases</h3>
        <p style="margin:8px 0"><strong>Auto-Admin Promotion:</strong> If you register from certain IP addresses, you'll automatically become a Staff member with admin privileges. This is configured by the server administrator.</p>
      </div>
      
      <div style="text-align:center;padding:20px">
        <a href="/register" style="color:#00ffcc;text-decoration:none;font-weight:600;font-size:16px">
          → Go to Registration →
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
ol {
  list-style-position: inside;
}

ul {
  list-style: disc inside;
}
</style>
