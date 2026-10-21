## Admin Panel: An extension of the Caption Rating Application 
Design an interface showing off interesting statistics from the data. Be creative in the data you choose to highlight and the way in which you highlight it.

Also create a way to manage users/profiles, AI generated media, and upvotes/downvotes/ratings.

You should be able to:
- **READ** users/profiles
- **CREATE/READ/UPDATE/DELETE** AI generated media
- **READ** upvotes/downvotes/ratings

**Important**: Make sure every route in your admin area is behind a Google login wall. Only allow users with a specific database field (like profiles.is_superadmin==TRUE). If you don’t do this step, you’ll expose your database to the entire internet.

**Question**: But wait, if this specific database field is required to use your own admin area, won’t you be locked out? Given the tools and access you currently have at your disposal, how could you solve this problem?

Turn off Vercel “deployment protection” so that you can view your page in Incognito Mode.

Submit the latest commit-specific URL of your two Vercel apps (AI-generated media creation and rating app and your admin area app) in the “Submissions” section.
