require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:session_key) { Rails.application.config.session_options[:key] }

  it "connects as the user from the session cookie" do
    user = create(:user)
    # テスト用 cookie jar は Hash を cookie オプションとして解釈するため value: で包む
    cookies.encrypted[session_key] = { value: { "user_id" => user.id } }

    connect "/cable"

    expect(connection.current_user).to eq(user)
  end

  it "rejects a connection without a session cookie" do
    expect { connect "/cable" }.to have_rejected_connection
  end

  it "rejects a connection whose session points to an unknown user" do
    cookies.encrypted[session_key] = { value: { "user_id" => -1 } }

    expect { connect "/cable" }.to have_rejected_connection
  end
end
