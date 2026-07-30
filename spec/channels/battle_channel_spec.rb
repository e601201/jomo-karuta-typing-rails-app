require "rails_helper"

RSpec.describe BattleChannel, type: :channel do
  let(:host) { create(:user) }
  let(:guest) { create(:user) }
  let(:room) { create(:battle_room, :matched, host: host, guest: guest) }
  let(:ta_room) { create(:battle_room, :timeattack, :matched, host: host, guest: guest) }

  def subscribe_as(user, target)
    stub_connection current_user: user
    subscribe id: target.id
  end

  describe "#subscribed" do
    it "rejects a non-participant" do
      subscribe_as(create(:user), room)

      expect(subscription).to be_rejected
    end

    it "rejects a subscription to an unknown room" do
      stub_connection current_user: host
      subscribe id: -1

      expect(subscription).to be_rejected
    end

    it "streams for the room and transmits a state snapshot" do
      subscribe_as(host, room)

      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(room)
      expect(transmissions.last).to eq(
        "type" => "state", "status" => "matched", "players" => [ host.id, guest.id ]
      )
    end
  end

  describe "#ready" do
    it "relays ready with the sender's id" do
      subscribe_as(host, room)

      expect { perform :ready }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with("type" => "ready", "userId" => host.id)
    end
  end

  describe "#progress" do
    it "relays the sender's taken count" do
      subscribe_as(guest, room)

      expect { perform :progress, "taken" => 3 }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with("type" => "progress", "userId" => guest.id, "taken" => 3)
    end

    it "coerces a non-numeric taken to 0 instead of raising" do
      subscribe_as(guest, room)

      expect { perform :progress, "taken" => [] }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with("type" => "progress", "userId" => guest.id, "taken" => 0)
    end
  end

  describe "#finished" do
    it "relays player_finished with whitelisted stats only" do
      subscribe_as(host, room)

      stats = { "score" => 8450, "taken" => 12, "accuracy" => 96.8, "wpm" => 72,
                "maxCombo" => 18, "evil" => "<script>" }
      expect { perform :finished, "stats" => stats }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with(
          "type" => "player_finished", "userId" => host.id,
          "stats" => { "score" => 8450, "timeMs" => nil, "taken" => 12,
                       "accuracy" => 96.8, "wpm" => 72, "maxCombo" => 18 }
        )
    end

    it "marks a random room finished without deciding a winner" do
      subscribe_as(host, room)

      expect { perform :finished, "stats" => { "score" => 100 } }
        .not_to have_broadcasted_to(room).from_channel(described_class)
        .with(a_hash_including("type" => "match_decided"))

      expect(room.reload.status).to eq("finished")
    end

    it "decides the first timeattack finisher as the winner" do
      subscribe_as(host, ta_room)

      expect { perform :finished, "stats" => { "timeMs" => 58_320, "taken" => 10 } }
        .to have_broadcasted_to(ta_room).from_channel(described_class)
        .with(a_hash_including("type" => "match_decided", "winnerId" => host.id))

      expect(ta_room.reload.status).to eq("finished")
    end

    it "does not re-decide when the loser reports after the match was decided" do
      ta_room.update!(status: :finished)
      subscribe_as(guest, ta_room)

      expect { perform :finished, "stats" => { "taken" => 7 } }
        .not_to have_broadcasted_to(ta_room).from_channel(described_class)
        .with(a_hash_including("type" => "match_decided"))
    end

    it "still relays player_finished when the room is already finished (second finisher fills the winner's result)" do
      room.update!(status: :finished)
      subscribe_as(guest, room)

      expect { perform :finished, "stats" => { "score" => 6920, "taken" => 9 } }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with(a_hash_including("type" => "player_finished", "userId" => guest.id))
    end

    it "coerces non-numeric stats values instead of raising" do
      subscribe_as(host, room)

      stats = { "score" => [ 1 ], "timeMs" => true, "taken" => { "a" => 1 }, "accuracy" => "97", "maxCombo" => nil }
      expect { perform :finished, "stats" => stats }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with(
          "type" => "player_finished", "userId" => host.id,
          "stats" => { "score" => nil, "timeMs" => nil, "taken" => 0,
                       "accuracy" => 0.0, "wpm" => nil, "maxCombo" => 0 }
        )
    end

    it "tolerates a non-hash stats payload" do
      subscribe_as(host, room)

      expect { perform :finished, "stats" => "junk" }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with(a_hash_including("type" => "player_finished"))
    end
  end

  describe "#unsubscribed" do
    it "cancels a waiting room when the host leaves" do
      waiting = create(:battle_room, host: host)
      subscribe_as(host, waiting)

      expect { subscription.unsubscribe_from_channel }
        .not_to have_broadcasted_to(waiting).from_channel(described_class)

      expect(waiting.reload.status).to eq("canceled")
    end

    it "finishes the room and notifies the opponent on a mid-game leave" do
      subscribe_as(host, room)

      expect { subscription.unsubscribe_from_channel }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with("type" => "opponent_left", "userId" => host.id)

      expect(room.reload.status).to eq("finished")
    end

    it "still notifies (but keeps status) when the room is already finished" do
      room.update!(status: :finished)
      subscribe_as(guest, room)

      expect { subscription.unsubscribe_from_channel }
        .to have_broadcasted_to(room).from_channel(described_class)
        .with("type" => "opponent_left", "userId" => guest.id)

      expect(room.reload.status).to eq("finished")
    end
  end
end
