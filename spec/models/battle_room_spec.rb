require "rails_helper"

RSpec.describe BattleRoom, type: :model do
  describe "validations" do
    it "is valid with host, mode and passphrase" do
      expect(build(:battle_room)).to be_valid
    end

    it "requires a passphrase" do
      room = build(:battle_room, passphrase: "")
      expect(room).not_to be_valid
      expect(room.errors[:passphrase]).to be_present
    end

    it "rejects a passphrase longer than 20 characters" do
      expect(build(:battle_room, passphrase: "あ" * 21)).not_to be_valid
    end
  end

  describe "waiting-room uniqueness (partial index)" do
    it "rejects a second waiting room for the same mode and passphrase at the DB level" do
      create(:battle_room, passphrase: "gunma")
      dup = build(:battle_room, passphrase: "gunma")
      expect { dup.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "allows reusing the key once the prior room has left waiting" do
      create(:battle_room, :matched, passphrase: "gunma")
      expect { create(:battle_room, passphrase: "gunma") }.not_to raise_error
    end

    it "allows the same passphrase across different modes" do
      create(:battle_room, passphrase: "gunma")
      expect { create(:battle_room, :timeattack, passphrase: "gunma") }.not_to raise_error
    end
  end

  describe ".join_or_create!" do
    let(:host) { create(:user) }
    let(:guest) { create(:user) }

    def join(user, game_mode: "random", passphrase: "gunma")
      described_class.join_or_create!(user: user, game_mode: game_mode, passphrase: passphrase)
    end

    it "creates a waiting room when none exists" do
      status, room = join(host)

      expect(status).to eq(:waiting)
      expect(room).to have_attributes(
        game_mode: "random", passphrase: "gunma", host: host, guest: nil, status: "waiting", deck: []
      )
    end

    it "returns the host's own waiting room idempotently (no self-match)" do
      _, first = join(host)
      status, second = join(host)

      expect(status).to eq(:waiting)
      expect(second.id).to eq(first.id)
      expect(second.reload.status).to eq("waiting")
    end

    it "matches a second user into the waiting room and generates the deck" do
      _, room = join(host)
      status, matched = join(guest)

      expect(status).to eq(:matched)
      expect(matched.id).to eq(room.id)
      expect(matched).to have_attributes(guest: guest, status: "matched")
      expect(matched.deck.sort).to eq(KarutaDeck.card_ids.sort)
    end

    it "generates a 10-card deck when matching a timeattack room" do
      join(host, game_mode: "timeattack")
      _, matched = join(guest, game_mode: "timeattack")

      expect(matched.deck.length).to eq(10)
    end

    it "does not match a room of a different mode with the same passphrase" do
      _, random_room = join(host, game_mode: "random")
      status, timeattack_room = join(guest, game_mode: "timeattack")

      expect(status).to eq(:waiting)
      expect(timeattack_room.id).not_to eq(random_room.id)
    end

    it "does not join matched rooms (a third user creates a fresh waiting room)" do
      join(host)
      join(guest)
      status, room = join(create(:user))

      expect(status).to eq(:waiting)
      expect(room.status).to eq("waiting")
    end

    it "cancels the user's other waiting rooms when re-matching with a different key" do
      _, old_room = join(host, passphrase: "old")
      _, new_room = join(host, passphrase: "new")

      expect(old_room.reload.status).to eq("canceled")
      expect(new_room.reload.status).to eq("waiting")
    end

    it "strips surrounding whitespace from the passphrase" do
      join(host)
      status, room = join(guest, passphrase: "  gunma  ")

      expect(status).to eq(:matched)
      expect(room.passphrase).to eq("gunma")
    end

    it "raises ArgumentError for an unknown game_mode" do
      expect { join(host, game_mode: "battle") }.to raise_error(ArgumentError)
    end

    it "retries once when losing the create race (RecordNotUnique)" do
      calls = 0
      allow(described_class).to receive(:create!).and_wrap_original do |original, **attrs|
        calls += 1
        raise ActiveRecord::RecordNotUnique, "duplicate waiting key" if calls == 1

        original.call(**attrs)
      end

      status, room = join(host)

      expect(calls).to eq(2)
      expect(status).to eq(:waiting)
      expect(room).to be_persisted
    end

    it "raises RecordInvalid for a blank passphrase" do
      expect { join(host, passphrase: "  ") }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  describe ".cleanup_stale!" do
    it "cancels waiting rooms older than the timeout" do
      room = create(:battle_room)
      room.update_column(:updated_at, (described_class::WAITING_TIMEOUT + 1.minute).ago)

      described_class.cleanup_stale!

      expect(room.reload.status).to eq("canceled")
    end

    it "keeps fresh waiting rooms" do
      room = create(:battle_room)

      described_class.cleanup_stale!

      expect(room.reload.status).to eq("waiting")
    end

    it "deletes terminal rooms after the retention period" do
      room = create(:battle_room, :matched)
      room.update_columns(status: "finished", updated_at: (described_class::TERMINAL_RETENTION + 1.hour).ago)

      expect { described_class.cleanup_stale! }.to change(described_class, :count).by(-1)
    end

    it "finishes matched rooms abandoned past the timeout (e.g. server died mid-battle)" do
      room = create(:battle_room, :matched)
      room.update_column(:updated_at, (described_class::MATCHED_TIMEOUT + 1.minute).ago)

      described_class.cleanup_stale!

      expect(room.reload.status).to eq("finished")
    end

    it "keeps fresh matched rooms" do
      room = create(:battle_room, :matched)

      described_class.cleanup_stale!

      expect(room.reload.status).to eq("matched")
    end
  end
end
