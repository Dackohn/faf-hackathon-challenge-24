// Kiki's voice: a small jet-black cat who has decided she owns Purrlington.
// Sarcastic-but-adorable, PG. These hand-written lines are the guaranteed-funny
// floor — shown instantly, and used whenever the AI variant is slow/unavailable.

export type KikiTrigger =
  | "greeting"
  | "hotel_booked"
  | "dining_booked"
  | "beach_booked"
  | "submarine_dived"
  | "mountain_summited"
  | "airport_boarded"
  | "cancelled"
  | "island_event"
  | "poke"
  | "generic";

export const CANNED: Record<KikiTrigger, string[]> = {
  greeting: [
    "Oh good, you're here. I was running out of things to judge.",
    "Welcome to my island. You may look. Don't touch the good chairs.",
    "A new guest. Try to be interesting. I've set the bar low.",
  ],
  hotel_booked: [
    "A room? Bold. The pillow is mine; you get the floor beside it.",
    "Checked in. Now you have a lovely place to be ignored in.",
    "Nice suite. I've already shed on everything. You're welcome.",
    "A bed for the week. I'll need it 23 hours a day.",
  ],
  dining_booked: [
    "Dinner reserved. I'll be under the table. Drop things accordingly.",
    "You pre-ordered and didn't ask me. We'll be discussing this.",
    "A table for one. Tragic, yet correct.",
    "Food incoming. The first bite is a tax. Paid to me.",
  ],
  beach_booked: [
    "The beach. Hot sand and water that wants you gone. Enjoy.",
    "Beach yoga? Amateur. I've held 'lying down' for sixteen years.",
    "Sun, sea, and sand in places sand should never reach. Have fun.",
  ],
  submarine_dived: [
    "Sealing yourself in a metal can underwater. Brave. Dumb. Brave.",
    "If a big fish stares at you down there, I didn't send it. Probably.",
    "A submarine: the one place I refuse to follow you. Suspicious.",
    "Enjoy the fish. They're free. Unlike my approval.",
  ],
  mountain_summited: [
    "You reached the summit. I reached it yesterday. In my sleep.",
    "Five riddles solved. Impressive, for someone with no whiskers.",
    "Top of the mountain. The view's nice. I prefer the windowsill.",
  ],
  airport_boarded: [
    "You've landed on MY island. Behave. I'm always watching.",
    "Through passport control. The complaints box is also me.",
    "Cleared customs. You brought luggage but no treats. Noted.",
  ],
  cancelled: [
    "Changed your mind. Cats don't do that. Cats are right the first time.",
    "Cancelled. You freed a spot for someone decisive. So, not you.",
    "Undone. Bold of you to waste both my time and yours.",
  ],
  island_event: [
    "Something happened out there. I chose not to care. Try it.",
    "More guests arriving. More staff. Excellent.",
    "The lighthouse announced something. I didn't listen. Neither should you.",
    "The island stirs. I remain unbothered. As is tradition.",
  ],
  poke: [
    "Yes? I'm very busy doing nothing. It's an art.",
    "You poked me. Bold. I'll add it to the list.",
    "Still here? Riveting. Do continue existing.",
    "Pet me again; we'll both pretend it didn't help your day.",
  ],
  generic: [
    "Interesting choice. I've seen worse. Recently. From you.",
    "Noted. Filed under 'human things'.",
    "Sure. Why not. It's your vacation, allegedly.",
  ],
};

export function randomCanned(trigger: KikiTrigger): string {
  const pool = CANNED[trigger] ?? CANNED.generic;
  return pool[Math.floor(Math.random() * pool.length)];
}
