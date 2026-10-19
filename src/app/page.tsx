
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

const CONTACT_EMAIL = "newlauren.94@gmail.com";
const CONTACT_PHONE = "2062067155";
const DISPLAY_PHONE = "(206) 206-7155";

const LOGIN_FOR_BOOKING = "/login?next=%2Fbook";
const SIGNUP_FOR_BOOKING = "/signup?next=%2Fbook";

const services = [
  {
    number: "03",
    id: "boarding",
    title: "Overnight Boarding",
    description:
      "A comfortable stay in a caregiver’s home. We’ll ask how your dog does around other pets and match them with a caregiver who fits.",
    details: [
      { label: "Drop-off:", value: "8:00 PM" },
      { label: "Morning pickup:", value: "7:00–8:00 AM (includes a one-hour grace period)" },
      { label: "After 8:00 AM:", value: "daytime boarding may be needed; we’ll confirm any extra charge with you" },
    ],
    rates: [
      "Standard boarding — $40/night",
      "Solo care, no other pets — $55/night",
      "Pickup or drop-off — $20 each way",
      "Second pet — 10% off · third pet — 15% off",
    ],
    image:
      "https://cdn.shopify.com/s/files/1/0268/7349/5624/files/Is_boarding_traumatic_for_your_dog.jpg?v=1740765074&width=1200&height=500&crop=center",
    imageAlt: "Dogs spending time together in a boarding yard",
    href: "/booking-request?service=Boarding",
    action: "Ask about boarding",
    contactOnly: true,
  },
  {
    number: "04",
    id: "day-care",
    title: "Day Care",
    description:
      "Daytime care in a caregiver’s home. Choose supervised group play with dogs who are a good fit, or one-on-one care for dogs who need individual attention. A dedicated day-and-night facility is a future goal.",
    details: [
      { label: "Care setting:", value: "caregiver’s home" },
      { label: "Care hours:", value: "7:30 AM–6:00 PM" },
      { label: "Drop-off:", value: "as early as 7:00 AM" },
      { label: "Pickup:", value: "by 7:00 PM" },
      { label: "Late pickup:", value: "$10 after 6:00 PM through 7:00 PM" },
      { label: "After 7:00 PM without calling:", value: "$40 standard or $55 one-on-one overnight boarding fee" },
    ],
    rates: ["Group care with other dogs — $45/day", "One-on-one care — $90/day"],
    image:
      "https://images.unsplash.com/photo-1638766211645-505c1c678b2b?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "Dogs playing together during group day care",
    href: "/booking-request?service=Doggy%20Day%20Care",
    action: "Book day care",
    contactOnly: false,
  },
  {
    number: "05",
    id: "house-sitting",
    title: "Overnight House Sitting",
    description:
      "A caregiver stays in your home overnight, keeping your pet in safe, familiar surroundings and routines.",
    details: [
      { label: "Overnight care:", value: "10:00 PM–7:00 AM" },
      { label: "Morning extension:", value: "up to 2 hours, until 9:00 AM — +$20" },
    ],
    rates: ["Overnight care — $90/night", "2-hour morning extension (until 9:00 AM) — +$20"],
    image:
      "https://images.unsplash.com/photo-1760791511030-ddad4c350cbb?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "Dog relaxing comfortably at home",
    href: "/booking-request?service=House%20Sitting",
    action: "Explore house sitting",
    contactOnly: false,
  },
  {
    number: "01",
    id: "drop-ins",
    title: "Drop-In Visits",
    description:
      "Short, scheduled check-ins at home for dogs and cats. Medication support is available as an add-on.",
    details: [
      { label: "Visits include:", value: "feeding, fresh water, play, and companionship" },
      { label: "Medication:", value: "+$5 per visit" },
      { label: "Pets:", value: "dogs and cats" },
    ],
    rates: ["30 minutes — $30", "45 minutes — $35"],
    image:
      "https://images.unsplash.com/photo-1616715655554-682697b9128b?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "Cat resting comfortably at home",
    href: "/booking-request?service=Drop-In%20Visits",
    action: "Book a drop-in",
    contactOnly: false,
  },
  {
    number: "02",
    id: "dog-walking",
    title: "Dog Walking",
    description:
      "Reliable walks with fresh air and exercise, planned around your dog’s routine and energy.",
    details: [
      { label: "Included:", value: "doggie bags" },
      { label: "Available for:", value: "dogs only" },
    ],
    rates: ["30 minutes — $25", "60 minutes — $45"],
    image:
      "https://images.unsplash.com/photo-1758633226887-8a1164f408a7?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "A person walking a dog through a grassy park",
    href: "/booking-request?service=Dog%20Walking",
    action: "Book a dog walk",
    contactOnly: false,
  },
  {
    number: "06",
    id: "extras",
    title: "Vet Transportation",
    description:
      "Need help getting your pet to a vet appointment? We can pick them up, take them to the clinic, and bring them home later if you request a return trip.",
    details: [
      { label: "Booking:", value: "on its own or with another service" },
      { label: "Travel area:", value: "within 15 miles" },
      { label: "Scheduling:", value: "provide your home, clinic, and appointment details" },
    ],
    rates: ["Vet transportation — $35 per one-way trip"],
    image:
      "https://images.unsplash.com/photo-1770836037289-e00e5f351d11?auto=format&fit=crop&crop=faces,center&w=1200&h=500&q=85",
    imageAlt: "A dog receiving a gentle veterinary check-up",
    href: "/booking-request?service=Vet%20Transportation",
    action: "Book extras and add-ons",
    contactOnly: false,
  },
];

const values = [
  {
    icon: "♡",
    title: "Care shaped around your pet",
    text: "Visits follow your pet’s routine, pace, and comfort, with attention to the little details that help them feel at home.",
  },
  {
    icon: "✳",
    title: "Attentive, gentle visits",
    text: "From feeding and fresh water to playtime and companionship, each check-in is centered on what your pet needs.",
  },
  {
    icon: "⌂",
    title: "Peace of mind for you",
    text: "Medication support is available during drop-ins for an additional $5 per visit, with clear instructions from you.",
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
            Our Services
          </a>

          <a href={`mailto:${CONTACT_EMAIL}?subject=Join%20our%20team`} onClick={closeMenu}>
            Join Our Team
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
            BOARDING · HOUSE SITTING · DROP-INS · DOGGY DAY CARE · DOG WALKING
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

      <section className="account-strip" aria-label="Customer account">
        <p>Pet details, appointment requests, and bookings—all in one place.</p>
        <div>
          <a href={SIGNUP_FOR_BOOKING}>Create an account</a>
          <a href={LOGIN_FOR_BOOKING}>Customer sign in</a>
        </div>
      </section>

      {/* SERVICES AND PRICING */}
      <section className="services section-pad" id="services">
          <div className="section-heading">
          <div>
            <div className="section-label">
              THOUGHTFUL CARE FOR EVERY KIND OF DAY
            </div>

            <h2>
              What kind of care
              <br />
              <span>does your pet need?</span>
            </h2>
          </div>

          <p>
            From neighborhood walks to cozy stays, find care that fits your
            pet&apos;s routine and comfort.
          </p>
        </div>

        <div className="service-grid">
          {[...services].sort((a, b) => Number(a.number) - Number(b.number)).map((service) => (
            <article className="service-card" id={service.id} key={service.number}>
              <a
                className="service-photo"
                href={service.href}
                aria-label={`${service.action}: ${service.title}`}
              >
                <img
                  className="service-photo-image"
                  src={service.image}
                  alt={service.imageAlt}
                  loading="lazy"
                  decoding="async"
                />
              </a>

              <div className="service-card-content">
                <h3>{service.title}</h3>

                <div className="service-description">{service.description}</div>

                <ul className="service-details">
                  {service.details.map((detail) => (
                    <li key={detail.label}>
                      <strong>{detail.label}</strong> {detail.value}
                    </li>
                  ))}
                </ul>

                <div className="service-prices">
                  {service.rates.map((rate) => (
                    <div className="service-price" key={rate}>
                      {rate}
                    </div>
                  ))}
                </div>

                <div className="service-card-bottom">
                  <a
                    className="book-now-button"
                    href={service.href}
                    aria-label={service.action}
                  >
                    Book Now
                  </a>
                </div>
              </div>
            </article>
          ))}
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
          <a
            href="https://www.facebook.com/profile.php?id=61595580778675"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          
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
