# The Weirdest Project Journey Ever... Till Now! 🎢

## The Accidental MVP

You know how sometimes you set out to make a sandwich and end up with a meal? Well, that's kind of what happened here. I wanted to create a mockup for hcproduct.switchboard, nameed switchboard-mockup, but plot twist: I accidentally built an MVP which took ~~2 weeks~~ 4 weeks! 🤦‍♂️

## The Tech Rollercoaster 🎢

### Round 1: The Classic Approach

- **Tech Stack:** Node.js + Express + Supabase
- **Target:** A machine deployment
- **Status:** ✅ Working, but... Supabase does offer serveress function!

### Round 2: The Serverless Seduction

- **New Plan:** Supabase Edge Functions
- **Runtime:** Deno (Hello, I have no idea! 📚)
- **Experience:** Surprisingly fun, I still have no idea! 🎉
- **Plot Twist:** Custom domain pricing 💸
  - $20/month for a dev account
  - Additional $10/month for a custom domain
  - Me: "That's gonna be a no from me. WTH! Absurd" 🙅‍♂️

### Round 3: Back to Old-school (My Old-school Free AWS)

- **Final Tech:** Node.js on AWS Lambda
- **Result:** MVP running at [switchboard.harrycorn.com](https://switchboard.harrycorn.com)

## The Road Ahead 🛣️

Next up on the to-do list:

- [ ] Add a caching mechanism for the Lambda function. Because who doesn't love a good cache? It's literrally money! 🍪💾
- [x] Set Ephemeral Storage /tmp (temporary storage of a lamdba initialized instance or executing environment) that stores the cache. Reference here: https://aws.amazon.com/blogs/aws/aws-lambda-now-supports-up-to-10-gb-ephemeral-storage/
- [x] Set Reserved concurrency (allocated from the quota 1000 of a region of my account). Don't even think about Provisioned concurrency, which is pre-initialized instances, which costs more.\
       At the moment, for a query on a 100-record data file, cold start would takes avg 7s where as warm start would takes avg 1.2s -> 2s max. \
       Reference here: https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html \
       ![ Concurrency](https://docs.aws.amazon.com/images/lambda/latest/dg/images/concurrency-7-reserved-vs-provisioned.png)

  - LOL! My newly-created account only has 10 Reserved concurrency

## Conclusion

Remember, folks: Sometimes the journey to create a simple mockup can lead you through a technological theme park. Embrace the ride, enjoy the views, and don't forget to scream on the sharp turns! 🎢🖥️🚀
