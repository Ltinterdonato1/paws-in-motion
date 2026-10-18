
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

const CONTACT_EMAIL = "newlauren.94@gmail.com";
const CONTACT_PHONE = "2062067155";
const DISPLAY_PHONE = "(206) 206-7155";

// Customers must sign in before proceeding to booking.
// The login/signup pages should preserve the next destination.
const LOGIN_FOR_BOOKING = "/login?next=%2Fbook";
const SIGNUP_FOR_BOOKING = "/signup?next=%2Fbook";

const services = [
  {
    number: "01",
    
    title: "Dog Walking",
    description:
      "Fresh air, exercise, and one-on-one attention. Every walk is tailored to your dog's pace and routine. Doggie bags are included, and we clean up after your dog during walks.",
    rates: ["30 minutes — $30", "60 minutes — $50"],
    image:
      "https://images.openai.com/static-rsc-4/oNLD51yUj8KS5QZS3sJpoOOGP98mODmWqopQedy5GC2u9-A6W6a8Q7MFQO61OhDfu7d5Yw-BGBXIG-7td25tBGRPy2Oi_GjMYCv0PZK-1YX7SO-G49iLLbWDvnZiWJqROeYGKL4GtPCVLDSI4dxXVLO-G3HrDqa_fQc-fiT2RGQ?purpose=inline",
    imageAlt: "Dog walking outdoors",
  },
  {
    number: "02",
    
    title: "Drop-In Visits",
    description:
      "Potty breaks, fresh water, meals, playtime, and companionship in the comfort of your pet's home.",
    rates: ["30 minutes — $30", "45 minutes — $40"],
    image:
      "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Dog spending time outdoors",
  },
  {
    number: "03",
    
    title: "Poop Pickup & Yard Cleanup",
    description:
      "Enjoy a cleaner yard without the hassle. We scoop, bag, and remove dog waste, leaving your outdoor space ready for play.",
    rates: [
      "One-time cleanup — $30",
      "Approximately 20–30 minutes",
      "Ask about regular weekly cleanups",
    ],
    image:
      "https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Dog enjoying time outdoors",
  },
  {
    number: "04",
    
    title: "Dog Bathing",
    description:
      "Give your pup a fresh start with a basic bath, rinse, and towel dry. Bathing is available for dogs only.",
    rates: [
      "Small dogs — $25",
      "Medium dogs — $35",
      "Large dogs — $45+",
    ],
    image:
      "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Dog enjoying gentle care",
  },
  {
    number: "05",
    
    title: "Pet Sitting & Overnight Care",
    description:
      "Comfortable in-home care with familiar routines, evening attention, and morning care.",
    rates: [
      "Flexible overnight — $80/night",
      "Dedicated overnight — $100/night",
    ],
    image:
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Dog relaxing comfortably",
  },
];

const values = [
  {
    icon: "♡",
    title: "Care comes first",
    text: "Every pet has their own personality, routine, and needs. We treat them as individuals.",
  },
  {
    icon: "✳",
    title: "Reliable & thoughtful",
    text: "We know your pets are family. Clear communication and thoughtful care matter.",
  },
  {
    icon: "⌂",
    title: "Peace of mind",
    text: "Your pet's comfort and safety guide every visit and walk.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    pet: "",
    service: "Dog Walking",
    message: "",
  });

  function updateForm(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = encodeURIComponent(
      `Paws in Motion inquiry — ${form.service}`
    );

    const body = encodeURIComponent(
      `New Paws in Motion inquiry\n\n` +
        `Name: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Pet's name: ${form.pet}\n` +
        `Interested in: ${form.service}\n\n` +
        `Message:\n${form.message || "No additional message."}`
    );

    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main>
      {/* HEADER */}
      <header className="site-header">
        <a
          className="brand"
          href="#home"
          onClick={closeMenu}
          aria-label="Paws in Motion home"
        >
          <span className="brand-mark">
            p<span>✳</span>
          </span>

          <span className="brand-name">
            paws in motion
            <small>THOUGHTFUL PET CARE · SEATTLE</small>
          </span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          aria-label={
            menuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav
          className={
            menuOpen ? "navigation navigation-open" : "navigation"
          }
        >
          <a href="#services" onClick={closeMenu}>
            Services & Pricing
          </a>

          

          <a href="/login" onClick={closeMenu}>
            Sign In
          </a>

          <a href="/signup" onClick={closeMenu}>
            Create Account
          </a>

          
        </nav>
      </header>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            YOUR NEIGHBORHOOD PET CARE PARTNER
          </div>

          <h1>
            Big love.
            <br />
            Little <span>paws.</span>
            <br />
            Every day.
          </h1>

          <p className="hero-description">
            Thoughtful pet care for the ones who make your house a home.
            More tail wags, more fresh air, and more peace of mind.
          </p>

          <div className="hero-actions">
            <a 
              className="button button-green" 
              href="#services"
              style={{ borderRadius: '9999px' }}
            >
              Explore services & pricing 
            </a>
          </div>

          <div className="hero-footnote">
            WALKING · DROP-INS · YARD CLEANUP · BATHING · OVERNIGHT CARE
          </div>
        </div>

        <div
          className="hero-photo"
          role="img"
          aria-label="A happy golden retriever enjoying the outdoors"
        >
          <div className="hero-photo-shade" />

          

          <div className="hero-photo-caption">
            A little fresh air goes a long way.
          </div>
        </div>

        <div className="hero-bottom">
          <span className="hero-bottom-location">
            SEATTLE, WASHINGTON
          </span>
        </div>
      </section>

      {/* CUSTOMER ACCOUNT PROMPT */}
      {/* CUSTOMER ACCOUNT PROMPT */}
      <section className="intro section-pad">
        <div className="section-label">
          YOUR PET'S CARE, ALL IN ONE PLACE
        </div>

        <div className="intro-grid">
          <h2>
            More tail wags.
            <br />
            <span>Less to worry about.</span>
          </h2>

          <div className="intro-copy">
            <p>
              Create your customer account to keep your pets' information
              organized, request appointments, and manage your bookings
              in one convenient place.
            </p>

            <div className="intro-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'flex-start', marginTop: '1.5rem' }}>
              <a 
                className="button button-green" 
                href={SIGNUP_FOR_BOOKING}
                style={{ borderRadius: '9999px' }}
              >
                Create your account 
              </a>

              <a 
                className="button button-green" 
                href={LOGIN_FOR_BOOKING}
                style={{ borderRadius: '9999px' }}
              >
                Manage your appointments 
              </a>

              <p className="signin-text" style={{ margin: '0.25rem 0 0 0' }}>
                Already have an account?{" "}
                <a className="underlined-link" href="/login">
                  Sign in here 
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="intro-stamp" aria-hidden="true">
          ALL PAWS
          <br />
          WELCOME <span>♡</span>
        </div>
      </section>

      {/* SERVICES AND PRICING */}
      <section className="services section-pad" id="services">
        <div className="section-heading">
          <div>
            <div className="section-label">
              OUR SERVICES & PRICING
            </div>

            <h2>
              A little care.
              <br />
              <span>A lot of happy.</span>
            </h2>
          </div>

          <p>
            Thoughtful care, straightforward pricing, and happy tails.
            Find the right fit for your best friend.
          </p>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.number}>
              <a
                className="service-photo"
                href={LOGIN_FOR_BOOKING}
                style={{
                  backgroundImage: `url("${service.image}")`,
                }}
                aria-label={`Sign in to book ${service.title}`}
              >
                
              </a>

              <div className="service-card-content">
                <h3>{service.title}</h3>

                <p>{service.description}</p>

                <div className="service-prices">
                  {service.rates.map((rate) => (
                    <div className="service-price" key={rate}>
                      {rate}
                    </div>
                  ))}
                </div>

                <div className="service-card-bottom">
                  <span>Ready when you are</span>

                  <a
                    className="book-now-button"
                    href={LOGIN_FOR_BOOKING}
                    aria-label={`Sign in to book ${service.title}`}
                  >
                    Book Now 
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ADDITIONAL PRICING DETAILS */}
        <div className="pricing-note">
          <div className="pricing-note-heading">
            A few helpful details
          </div>

          <p>
            <strong>Dog Walking:</strong> Doggie bags are included.
           
          </p>

          <p>
            <strong>Poop Pickup:</strong> One-time yard cleanup starts
            at $30 We scoop, bag, and
            remove the waste. Ask us about regular weekly cleanups.
            
          </p>

          <p>
            <strong>Dog Bathing:</strong> Basic bath, rinse, and towel
            dry. Starting prices are $25 for small dogs, $35 for medium
            dogs, and $45+ for large dogs. Dogs only; nail trimming is
            not offered.** 
          </p>

          <p>
            <strong>Additional Pets:</strong> 10% off the second pet / 
            15% off the third pet.
          </p>

          <p>
            <strong>Repeat Customers:</strong> Our loyalty
            reward offers 10% off bookings on the
            second booking. Multi-pet discounts will be
            automatically applied in the booking system.
          </p>

          <p>
            <strong>Medication Administration:</strong> +$5 per visit
          </p>

          <p>
            <strong>Flexible Overnight — $80/night:</strong> Includes
            agreed-upon evening and morning care and an overnight stay.
            Other scheduled pet visits may require leaving for a couple
            of hours by prior agreement, provided your pet can safely
            be left alone.
          </p>

          <p>
            <strong>Dedicated Overnight — $100/night:</strong> Includes
            an overnight stay without leaving for other pet appointments.
          </p>
        </div>
        
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark">
            p<span>✳</span>
          </span>

          <span className="brand-name">
            paws in motion
            <small>THOUGHTFUL PET CARE · SEATTLE</small>
          </span>
        </a>

        <div className="footer-links">
          <a href="#services">Services & Pricing</a>
          
          
          <a href="/signup">Create Account</a>
          <a href="/login">Sign In</a>
          <a href={LOGIN_FOR_BOOKING}>Book / Manage an Appointment</a>
          
        </div>

        <div className="footer-contact">
          <a href={`tel:${CONTACT_PHONE}`}>
            Call {DISPLAY_PHONE}
          </a>

          <span>·</span>

          <a href={`sms:${CONTACT_PHONE}`}>Text us</a>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Paws in Motion</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
