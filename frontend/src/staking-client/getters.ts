import { IAccount } from "@/staking-client/interfaces"
import { Harmony } from "@harmony-js/core";
import {ChainID, ChainType} from "@harmony-js/utils";

const RETRIES = 4

// const URL_TESTNET = `https://api.s0.b.hmny.io`;
const URL_MAINNET = `https://api.s0.t.hmny.io`

export default class Getters {
  url: string
  harmony: Harmony

  constructor(cosmosRESTURL: string) {
    this.url = cosmosRESTURL

    // 1. initialize the Harmony instance
    this.harmony = new Harmony(
      // rpc url
      URL_MAINNET,
      {
        // chainType set to Harmony
        chainType: ChainType.Harmony,
        // chainType set to HmyLocal
        // chainId: ChainID.HmyTestnet
        chainId: ChainID.Default
      } as any // HarmonyConfig
    )
  }

  // request and retry
  get = (path: string, tries: number = RETRIES): any => {
    while (tries) {
      try {
        return fetch(this.url + path).then(res => res.json())
      } catch (err) {
        if (--tries === 0) {
          throw err
        }
      }
    }
  }

  // meta
  connected = () => {
    return this.nodeVersion().then(() => true, () => false)
  }

  nodeVersion = () => fetch(this.url + `/node_version`).then(res => res.text())

  // coins
  account = (address: string): Promise<IAccount> => {
    const emptyAccount: IAccount = {
      coins: [],
      sequence: `0`,
      account_number: `0`,
      address
    };

    return this.harmony.blockchain
      .getBalance({ address })
      .then((res: any) => {
        const amount = new this.harmony.utils.Unit(res.result).asWei().toSzabo()

        emptyAccount.coins.push({ denom: "one", amount });

        return emptyAccount
      })
      .catch((err: any) => {
        console.log(err)

        return emptyAccount
      })
  };

  txs = (addr: string) => {
    return Promise.all([
      this.bankTxs(addr),
      this.governanceTxs(addr),
      this.distributionTxs(addr),
      this.stakingTxs(addr)
    ]).then(txs => [].concat(...txs))
  }

  bankTxs = (addr: string) => {
    return Promise.all([
      this.get(`/txs?sender=${addr}`),
      this.get(`/txs?recipient=${addr}`)
    ]).then(([senderTxs, recipientTxs]) => [].concat(senderTxs, recipientTxs))
  }

  txsByHeight = (height: string) => this.get(`/txs?tx.height=${height}`)

  // tx = (hash: string) => this.get(`/txs/${hash}`)

  /* ============ STAKE ============ */
  stakingTxs = async (address: string, valAddress: string = "") => {
    return Promise.all([
      this.get(
        `/txs?action=create_validator&destination-validator=${valAddress}`
      ),
      this.get(
        `/txs?action=edit_validator&destination-validator=${valAddress}`
      ),
      this.get(`/txs?action=delegate&delegator=${address}`),
      this.get(`/txs?action=begin_redelegate&delegator=${address}`),
      this.get(`/txs?action=begin_unbonding&delegator=${address}`),
      this.get(`/txs?action=unjail&source-validator=${valAddress}`)
    ]).then(
      ([
        createValidatorTxs,
        editValidatorTxs,
        delegationTxs,
        redelegationTxs,
        undelegationTxs,
        unjailTxs
      ]) =>
        [].concat(
          createValidatorTxs,
          editValidatorTxs,
          delegationTxs,
          redelegationTxs,
          undelegationTxs,
          unjailTxs
        )
    )
  }
  // Get all delegations information from a delegator
  delegations = (addr: string) => {
    return this.get(`/staking/delegators/${addr}/delegations`)
  }
  undelegations = (addr: string) => {
    return this.get(`/staking/delegators/${addr}/unbonding_delegations`, 1)
  }
  redelegations = (addr: string) => {
    return this.get(`/staking/redelegations?delegator=${addr}`)
  }
  // Query all validators that a delegator is bonded to
  // delegatorValidators = (delegatorAddr: string) => {
  //   return this.get(`/staking/delegators/${delegatorAddr}/validators`)
  // }
  // Get a list containing all the validator candidates
  validators = () =>
    Promise.all([
      this.get(`/staking/validators?status=unbonding`),
      this.get(`/staking/validators?status=bonded`),
      this.get(`/staking/validators?status=unbonded`)
    ]).then(validatorGroups => [].concat(...validatorGroups))
  // Get information from a validator
  validator = (addr: string) => {
    return this.get(`/staking/validators/${addr}`)
  }

  // Get the list of the validators in the latest validator set
  // validatorSet = () => this.get(`/validatorsets/latest`)

  // Query a delegation between a delegator and a validator
  delegation = (delegatorAddr: string, validatorAddr: string) => {
    return this.get(
      `/staking/delegators/${delegatorAddr}/delegations/${validatorAddr}`,
      1
    )
  }
  // unbondingDelegation = (delegatorAddr: string, validatorAddr: string) => {
  //   return this.get(
  //     `/staking/delegators/${delegatorAddr}/unbonding_delegations/${validatorAddr}`,
  //     1
  //   )
  // }

  pool = () => this.get(`/staking/pool`)

  stakingParameters = () => this.get(`/staking/parameters`)

  /* ============ Slashing ============ */

  // validatorSigningInfo = (pubKey: string) => {
  //   return this.get(`/slashing/validators/${pubKey}/signing_info`)
  // }

  /* ============ Governance ============ */

  proposals = () => this.get(`/gov/proposals`)
  proposal = (proposalId: string) => {
    return this.get(`/gov/proposals/${proposalId}`)
  }
  proposalVotes = (proposalId: string) => {
    return this.get(`/gov/proposals/${proposalId}/votes`)
  }
  // proposalVote = (proposalId: string, address: string) => {
  //   return this.get(`/gov/proposals/${proposalId}/votes/${address}`)
  // }
  proposalDeposits = (proposalId: string) => {
    return this.get(`/gov/proposals/${proposalId}/deposits`)
  }
  // proposalDeposit = (proposalId: string, address: string) => {
  //   return this.get(`/gov/proposals/${proposalId}/deposits/${address}`, 1)
  // }
  proposalTally = (proposalId: string) => {
    return this.get(`/gov/proposals/${proposalId}/tally`)
  }
  govDepositParameters = () => this.get(`/gov/parameters/deposit`)
  govTallyingParameters = () => this.get(`/gov/parameters/tallying`)
  govVotingParameters = () => this.get(`/gov/parameters/voting`)
  governanceTxs = async (address: string) => {
    return Promise.all([
      this.get(`/txs?action=submit_proposal&proposer=${address}`),
      this.get(`/txs?action=deposit&depositor=${address}`),
      this.get(`/txs?action=vote&voter=${address}`)
    ]).then(([submitProposalTxs, depositTxs, voteTxs]) =>
      [].concat(submitProposalTxs, depositTxs, voteTxs)
    )
  }
  /* ============ Explorer ============ */
  block = (blockHeight: string) => {
    return this.get(`/blocks/${blockHeight}`)
  }
  /* ============ Distribution ============ */
  distributionTxs = async (address: string, valAddress: string = "") => {
    return Promise.all([
      this.get(`/txs?action=set_withdraw_address&delegator=${address}`),
      this.get(`/txs?action=withdraw_delegator_reward&delegator=${address}`),
      this.get(
        `/txs?action=withdraw_validator_rewards_all&source-validator=${valAddress}`
      )
    ]).then(
      ([
        updateWithdrawAddressTxs,
        withdrawDelegationRewardsTxs,
        withdrawValidatorCommissionTxs
      ]) =>
        [].concat(
          updateWithdrawAddressTxs,
          withdrawDelegationRewardsTxs,
          withdrawValidatorCommissionTxs
        )
    )
  }
  // delegatorRewards = (delegatorAddr: string) => {
  //   return this.get(`/distribution/delegators/${delegatorAddr}/rewards`)
  // }
  delegatorRewardsFromValidator = async (
    delegatorAddr: string,
    validatorAddr: string
  ) => {
    return (
      (await this.get(
        `/distribution/delegators/${delegatorAddr}/rewards/${validatorAddr}`
      )) || []
    )
  }
  // validatorDistributionInformation = (validatorAddr: string) => {
  //   return this.get(`/distribution/validators/${validatorAddr}`)
  // }
  // validatorRewards = (validatorAddr: string) => {
  //   return this.get(`/distribution/validators/${validatorAddr}/rewards`)
  // }
  distributionParameters = () => {
    return this.get(`/distribution/parameters`)
  }
  distributionOutstandingRewards = () => {
    return this.get(`/distribution/outstanding_rewards`)
  }

  annualProvisionedTokens = () => {
    return this.get(`/minting/annual-provisions`)
  }
  // inflation = () => {
  //   return this.get(`/minting/inflation`)
  // }
  // mintingParameters = () => {
  //   return this.get(`/minting/parameters`)
  // }
}
