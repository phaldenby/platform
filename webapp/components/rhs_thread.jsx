// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';
import SearchBox from './search_bar.jsx';
import CreateComment from './create_comment.jsx';
import RhsHeaderPost from './rhs_header_post.jsx';
import RootPost from './rhs_root_post.jsx';
import Comment from './rhs_comment.jsx';
import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;
import FileUploadOverlay from './file_upload_overlay.jsx';
import Scrollbars from 'react-custom-scrollbars';

import React from 'react';

export function renderView(props) {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props) {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props) {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

export default class RhsThread extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onPostChange = this.onPostChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.handleResize = this.handleResize.bind(this);

        const state = this.getPosts();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        state.profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        state.compactDisplay = PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT;

        this.state = state;
    }
    componentDidMount() {
        PostStore.addSelectedPostChangeListener(this.onPostChange);
        PostStore.addChangeListener(this.onPostChange);
        PreferenceStore.addChangeListener(this.forceUpdateInfo);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);

        this.scrollToBottom();
        window.addEventListener('resize', this.handleResize);

        this.mounted = true;
    }
    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onPostChange);
        PostStore.removeChangeListener(this.onPostChange);
        PreferenceStore.removeChangeListener(this.forceUpdateInfo);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);

        window.removeEventListener('resize', this.handleResize);

        this.mounted = false;
    }
    componentDidUpdate(prevProps, prevState) {
        const prevPostsArray = prevState.postsArray || [];
        const curPostsArray = this.state.postsArray || [];

        if (prevPostsArray.length >= curPostsArray.length) {
            return;
        }

        const curLastPost = curPostsArray[curPostsArray.length - 1];

        if (curLastPost.user_id === UserStore.getCurrentId()) {
            this.scrollToBottom();
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.postsArray, this.state.postsArray)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.selected, this.state.selected)) {
            return true;
        }

        if (nextState.compactDisplay !== this.state.compactDisplay) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.profiles, this.state.profiles)) {
            return true;
        }

        return false;
    }
    forceUpdateInfo() {
        if (this.state.postList) {
            for (var postId in this.state.postList.posts) {
                if (this.refs[postId]) {
                    this.refs[postId].forceUpdate();
                }
            }
        }
    }
    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }
    onPreferenceChange() {
        this.setState({
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT
        });
    }
    onPostChange() {
        if (this.mounted) {
            this.setState(this.getPosts());
        }
    }
    getPosts() {
        const selected = PostStore.getSelectedPost();
        const posts = PostStore.getSelectedPostThread();

        const postsArray = [];

        for (const id in posts) {
            if (posts.hasOwnProperty(id)) {
                const cpost = posts[id];
                if (cpost.root_id === selected.id) {
                    postsArray.push(cpost);
                }
            }
        }

        // sort failed posts to bottom, followed by pending, and then regular posts
        postsArray.sort((a, b) => {
            if ((a.state === Constants.POST_LOADING || a.state === Constants.POST_FAILED) && (b.state !== Constants.POST_LOADING && b.state !== Constants.POST_FAILED)) {
                return 1;
            }
            if ((a.state !== Constants.POST_LOADING && a.state !== Constants.POST_FAILED) && (b.state === Constants.POST_LOADING || b.state === Constants.POST_FAILED)) {
                return -1;
            }

            if (a.state === Constants.POST_LOADING && b.state === Constants.POST_FAILED) {
                return -1;
            }
            if (a.state === Constants.POST_FAILED && b.state === Constants.POST_LOADING) {
                return 1;
            }

            if (a.create_at < b.create_at) {
                return -1;
            }
            if (a.create_at > b.create_at) {
                return 1;
            }
            return 0;
        });

        return {postsArray, selected};
    }
    onUserChange() {
        const profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        this.setState({profiles});
    }
    scrollToBottom() {
        if ($('.post-right__scroll')[0]) {
            $('.post-right__scroll').parent().scrollTop($('.post-right__scroll')[0].scrollHeight);
        }
    }
    render() {
        const postsArray = this.state.postsArray;
        const selected = this.state.selected;
        const profiles = this.state.profiles || {};

        if (postsArray == null || selected == null) {
            return (
                <div></div>
            );
        }

        var currentId = UserStore.getCurrentId();
        var searchForm;
        if (currentId != null) {
            searchForm = <SearchBox/>;
        }

        let profile;
        if (UserStore.getCurrentId() === selected.user_id) {
            profile = UserStore.getCurrentUser();
        } else {
            profile = profiles[selected.user_id];
        }

        return (
            <div className='post-right__container'>
                <FileUploadOverlay overlayType='right'/>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <RhsHeaderPost
                        fromSearch={this.props.fromSearch}
                        isMentionSearch={this.props.isMentionSearch}
                    />
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderThumbHorizontal={renderThumbHorizontal}
                        renderThumbVertical={renderThumbVertical}
                        renderView={renderView}
                    >
                        <div className='post-right__scroll'>
                            <RootPost
                                ref={selected.id}
                                post={selected}
                                commentCount={postsArray.length}
                                user={profile}
                                currentUser={this.props.currentUser}
                                compactDisplay={this.state.compactDisplay}
                            />
                            <div className='post-right-comments-container'>
                                {postsArray.map((comPost) => {
                                    let p;
                                    if (UserStore.getCurrentId() === comPost.user_id) {
                                        p = UserStore.getCurrentUser();
                                    } else {
                                        p = profiles[comPost.user_id];
                                    }
                                    return (
                                        <Comment
                                            ref={comPost.id}
                                            key={comPost.id + 'commentKey'}
                                            post={comPost}
                                            user={p}
                                            currentUser={this.props.currentUser}
                                            compactDisplay={this.state.compactDisplay}
                                        />
                                    );
                                })}
                            </div>
                            <div className='post-create__container'>
                                <CreateComment
                                    channelId={selected.channel_id}
                                    rootId={selected.id}
                                />
                            </div>
                        </div>
                    </Scrollbars>
                </div>
            </div>
        );
    }
}

RhsThread.defaultProps = {
    fromSearch: '',
    isMentionSearch: false
};

RhsThread.propTypes = {
    fromSearch: React.PropTypes.string,
    isMentionSearch: React.PropTypes.bool,
    currentUser: React.PropTypes.object.isRequired
};
